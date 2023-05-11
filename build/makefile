# Top-level Makefile for recursively running Makefiles in all subdirectories

# Find all subdirectories containing a Makefile
SUBDIRS = $(shell find . -type f -name 'Makefile' -exec dirname {} \;)

# Default rule (first rule in the Makefile)
all: $(SUBDIRS)

# Rule to run 'make' in each subdirectory
$(SUBDIRS):
	$(MAKE) -C $@

# Clean rule to clean all subdirectories
clean:
	for dir in $(SUBDIRS); do \
		$(MAKE) -C $$dir clean; \
	done

.PHONY: all $(SUBDIRS) clean
