#!/usr/bin/env python3
"""Small static-file server with single-range GET/HEAD support."""

import argparse
import os
import re
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


class UnsatisfiableRange(ValueError):
    pass


class RangeRequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".mp4": "video/mp4",
    }

    def end_headers(self):
        # Keep live previews from mixing cached CSS/JS with freshly edited HTML.
        suffix = Path(urlsplit(self.path).path).suffix.lower()
        if suffix in ('', '.html', '.css', '.js'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            # Browsers routinely cancel media transfers when videos leave view.
            pass

    def parse_range(self, value, size):
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
        if not match or not any(match.groups()):
            raise ValueError("malformed Range header")
        first, last = match.groups()
        if size == 0:
            raise UnsatisfiableRange("range on empty file")
        if not first:
            length = int(last)
            if length == 0:
                raise UnsatisfiableRange("zero-length suffix")
            return max(0, size - length), size - 1
        start = int(first)
        end = int(last) if last else size - 1
        if start >= size or end < start:
            raise UnsatisfiableRange("range outside file")
        return start, min(end, size - 1)

    def send_head(self):
        self._byte_range = None
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            parts = urlsplit(self.path)
            if not parts.path.endswith("/"):
                location = urlunsplit((
                    parts.scheme, parts.netloc, parts.path + "/",
                    parts.query, parts.fragment,
                ))
                self.send_response(HTTPStatus.MOVED_PERMANENTLY)
                self.send_header("Location", location)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            for index in ("index.html", "index.htm"):
                candidate = os.path.join(path, index)
                if os.path.isfile(candidate):
                    path = candidate
                    break
            else:
                return self.list_directory(path)
        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        try:
            stat = os.fstat(source.fileno())
            size = stat.st_size
            start, length = 0, size
            range_value = self.headers.get("Range")
            status = HTTPStatus.OK
            if range_value:
                try:
                    start, end = self.parse_range(range_value, size)
                except UnsatisfiableRange:
                    source.close()
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return None
                except ValueError:
                    source.close()
                    self.send_error(HTTPStatus.BAD_REQUEST, "Malformed Range header")
                    return None
                status = HTTPStatus.PARTIAL_CONTENT
                length = end - start + 1
                self._byte_range = (start, length)

            self.send_response(status)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Length", str(length))
            self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
            self.send_header("Accept-Ranges", "bytes")
            if status == HTTPStatus.PARTIAL_CONTENT:
                self.send_header("Content-Range", f"bytes {start}-{start + length - 1}/{size}")
            self.end_headers()
            return source
        except Exception:
            source.close()
            raise

    def copyfile(self, source, outputfile):
        if not self._byte_range:
            return super().copyfile(source, outputfile)
        start, remaining = self._byte_range
        source.seek(start)
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    handler = partial(RangeRequestHandler, directory=str(args.directory.resolve()))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"Serving {args.directory.resolve()} at http://{args.bind}:{server.server_port}/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
