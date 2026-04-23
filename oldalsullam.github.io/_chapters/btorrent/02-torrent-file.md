---
layout:      chapter
title:       "The .torrent File Format"
short_title: "Torrent File"
project:     "btorrent"
order:       2
version:     "Core Protocol"
summary:     "Parse metadata and compute the info hash"
description: "A .torrent file is a bencoded dictionary describing what to download and where to find peers. This chapter covers its structure and how to compute the info hash."

tags:
  - Bencoding
  - Torrent File
  - Info Hash
  - SHA-1
---

## What Is a .torrent File?

A `.torrent` file is a bencoded dictionary that describes:
- **What** to download — file names, sizes, SHA-1 hashes of every piece
- **Where** to start — the tracker URL
- **How** it's split — piece length

It does **not** contain the actual data. Just metadata.

## Top-Level Structure

```
d
  8:announce      → tracker URL (string)
  13:announce-list→ list of tracker URL lists (optional)
  7:comment       → human description (optional)
  13:creation date→ Unix timestamp (optional)
  4:info          → the info dictionary ← most important
e
```

## The Info Dictionary

### Single-File Torrent

```
d
  4:name         → filename (string)
  6:length       → total bytes (int)
  12:piece length → bytes per piece (int, e.g. 262144)
  6:pieces       → raw SHA-1 hashes, concatenated (string)
e
```

### Multi-File Torrent

```
d
  4:name         → directory name (string)
  12:piece length → bytes per piece (int)
  6:pieces       → concatenated SHA-1 hashes (string)
  5:files        → list of file dicts:
    d
      6:length   → file size (int)
      4:path     → list of path components (list of strings)
    e
e
```

## The Info Hash — The Torrent's Identity

The **info hash** is SHA-1 of the raw bencoded bytes of the `info` dictionary, exactly as they appear in the file. No reformatting.

```c
uint8_t info_hash[20];
sha1(raw_info_bytes, raw_info_length, info_hash);
```

This 20-byte hash is used:
- In tracker requests: `?info_hash=<url-encoded 20 bytes>`
- In the peer handshake to verify you're downloading the same torrent
- As the torrent's global unique identifier — no central registry needed

<div class="callout spark">
<div class="callout-title">Why SHA-1 of the Raw Bytes?</div>
<p>We hash the <em>exact bytes</em> from the file, not a re-encoding. If keys were reordered or values reformatted, the hash would change. This is why bencoding requires sorted dict keys — canonical byte representation → canonical hash.</p>
</div>

## The Pieces Field

This is the most important field. A raw byte string of length `N × 20`, where `N` is the number of pieces:

```
pieces[0..19]   = SHA-1 of piece 0
pieces[20..39]  = SHA-1 of piece 1
pieces[40..59]  = SHA-1 of piece 2
...
```

After downloading each piece, SHA-1 hash it and compare against this table. Match → authentic. No match → corrupted, discard and retry.

## Piece Count

```c
int num_pieces = (total_length + piece_length - 1) / piece_length;

// Last piece is usually smaller
int last_piece_size = total_length % piece_length;
if (last_piece_size == 0) last_piece_size = piece_length;
```

## Parsing in `torrent.c`

1. Read the whole file into memory
2. Bencode-parse it
3. Locate `"info"` key → note its byte range in the raw buffer
4. `sha1(raw_info_bytes, end - start, info_hash)`
5. Extract all fields into `TorrentInfo`
6. Free the bencode tree

## Key Structures

```c
typedef struct {
    char     name[256];        // file or dir name
    uint8_t  info_hash[20];    // SHA-1 of info dict
    long     total_length;     // total bytes
    int      piece_length;     // bytes per piece
    int      num_pieces;
    uint8_t *pieces_hash;      // raw: num_pieces × 20 bytes
    char     announce[512];    // tracker URL
    int      is_multi_file;
    FileEntry files[MAX_FILES];
    int       num_files;
} TorrentInfo;
```

## Exercise

Open any `.torrent` file in a hex editor:

```bash
xxd ubuntu.torrent | head -60
```

You should see it starts with `64` (ASCII `d` = start of bencoded dict). Trace the structure manually — find the `4:info` key and where its value begins.
