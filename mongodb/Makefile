HOST     ?= 127.0.0.1
PORT     ?= 27017
ARCHIVE  ?= backup.archive

.PHONY: backup restore help

help:
	@echo "Usage:"
	@echo "  make backup              # Dump all DBs to $(ARCHIVE)"
	@echo "  make backup ARCHIVE=my.archive"
	@echo "  make restore             # Restore from $(ARCHIVE)"
	@echo "  make restore ARCHIVE=my.archive"

backup:
	mongodump --host $(HOST) --port $(PORT) --archive=$(ARCHIVE) --gzip
	@echo "Backup saved to $(ARCHIVE)"

restore:
	mongorestore --host $(HOST) --port $(PORT) --archive=$(ARCHIVE) --gzip --drop
	@echo "Restore from $(ARCHIVE) complete"
