.PHONY: help build check test run web clean

help:
	@echo "make build   regenerate web/data.bundle.js from data/"
	@echo "make check   fail if the committed bundle is stale"
	@echo "make test    run the test suite"
	@echo "make run     ODIUM in the terminal"
	@echo "make web     serve the web frontend on :8000"

build:
	python3 tools/build_web_data.py

check:
	python3 tools/build_web_data.py --check

test: check
	python3 tools/test_engine.py

run:
	python3 cli/odium.py

web:
	@echo "http://localhost:8000  (or just open web/index.html)"
	python3 -m http.server -d web 8000
