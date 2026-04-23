---
layout: project
title:       "BTorrent"
slug:        "btorrent"
number:      "001"
description: "A complete BitTorrent client written in C from scratch — bencoding parser, SHA-1 (RFC 3174), HTTP tracker protocol, peer wire protocol, and piece management. Every component documented for learning how P2P networking works at the byte level."
tagline:     "BitTorrent from first principles"
category:    "Networking / Protocols"
lang:        "C"
status:      "complete"
started:     "2024"
version:     "1.0.0"
lines_of_code: "~2,400"
tests:       "80 / 80 ✓"

github: "https://github.com/alsullam/btorrent"
links:
  - label: "BEP 0003 Spec"
    url:   "https://www.bittorrent.org/beps/bep_0003.html"
  - label: "RFC 3174 (SHA-1)"
    url:   "https://tools.ietf.org/html/rfc3174"

tags:
  - BitTorrent
  - Networking
  - P2P
  - SHA-1
  - Bencoding
  - C
---

BTorrent is an educational BitTorrent client built from absolute scratch in C. It implements the core BitTorrent v1 specification (BEP 0003) with no external libraries for the core logic — every algorithm hand-built and fully documented.

## What It Does

- Parses `.torrent` files (bencoded metadata format)
- Computes the info hash — SHA-1 of the bencoded info dict
- Announces to HTTP trackers and receives peer address lists
- Connects to peers via TCP and exchanges the 68-byte handshake
- Downloads pieces in 16 KiB blocks with request pipelining
- Verifies each piece against its stored SHA-1 before writing to disk

## Quick Start

```bash
# Install libcurl (Ubuntu/Debian)
sudo apt install libcurl4-openssl-dev

# Build
make

# Run tests
make test   # → 80/80 passed

# Download a torrent
./btorrent file.torrent
./btorrent ubuntu.torrent /tmp/ubuntu.iso
```

## Architecture

The client is six independent modules. Each has a clean header API, a fully documented implementation, and a companion chapter explaining the theory.

Read the chapters in order to understand each layer of the protocol before seeing the implementation.
