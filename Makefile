# Aliases for humans. The real interface is bin/vawe (`bin/vawe --help`); each target here forwards to it.
# Usage: make dev PAGE=films/<name>/page.html [ARGS="--from 2 --to 6"]

.DEFAULT_GOAL := help
.PHONY: dev ship critique spec studio e2e test install-hooks help

dev:      ; @bin/vawe dev $(PAGE) $(ARGS)
ship:     ; @bin/vawe ship $(PAGE) $(ARGS)
critique: ; @bin/vawe critique $(PAGE) $(ARGS)
spec:     ; @bin/vawe see $(REF) --spec $(ARGS)
studio:   ; @bin/vawe studio $(PAGE) $(ARGS)
e2e:      ; @bin/vawe-dev e2e
test:     ; @bin/vawe-dev test

install-hooks:
	git config core.hooksPath .githooks
	@echo "hooks active: pre-commit (fast checks), pre-push (guards, plus the site gate, unit tests and e2e the changed paths need), commit-msg, post-checkout"

help:     ; @bin/vawe --help
