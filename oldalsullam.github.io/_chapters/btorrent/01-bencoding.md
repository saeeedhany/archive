---
layout:      chapter
title:       "Bencoding — BitTorrent's Serialization Format"
short_title: "Bencoding"
project:     "btorrent"
order:       1
version:     "Core Protocol"
summary:     "Parse integers, strings, lists, and dicts"
description: "Bencoding is BitTorrent's data serialization format. This chapter builds the recursive descent parser that reads .torrent files and tracker responses."

tags:
  - Bencoding
  - Parsing
  - Serialization
  - C
---

## What Is Bencoding?

Bencoding (pronounced "bee-encoding") is the data serialization format used throughout the BitTorrent protocol. It encodes `.torrent` file metadata, tracker responses, and peer exchange messages.

Think of it as a much simpler version of JSON — but designed to be unambiguous and parseable with minimal code. It supports exactly **4 types**:

| Type | Format | Example | Decoded |
|------|--------|---------|---------|
| Integer | `i<n>e` | `i42e` | 42 |
| String | `<len>:<data>` | `4:spam` | "spam" |
| List | `l…e` | `li1ei2ee` | [1, 2] |
| Dict | `d…e` | `d3:keyi1ee` | {"key": 1} |

## Parsing Strategy

We use a **recursive descent parser** — each type has its own function, and they call each other as needed. A `BencodeParser` struct holds a cursor through the raw bytes.

```c
parse_value()
  ├── if 'i' → parse_integer()
  ├── if 'l' → parse_list()  → calls parse_value() for each item
  ├── if 'd' → parse_dict()  → calls parse_value() for keys and values
  └── if digit → parse_string()
```

## Integers

Format: `i<decimal>e`. Read digits (and optional leading `-`), convert with `strtoll`.

```c
// i42e → 42, i-7e → -7, i0e → 0
// Invalid: i-0e (negative zero), i07e (leading zeros)
```

## Strings (Byte Strings)

Format: `<length>:<bytes>`. The length is ASCII decimal, then exactly that many raw bytes follow.

```c
// 4:spam → "spam"
// 20:<raw 20 bytes> → SHA-1 hash (binary, not text!)
```

<div class="callout info">
<div class="callout-title">Strings Are Raw Bytes</div>
<p>Bencoded strings are byte strings, not UTF-8 text. SHA-1 piece hashes are stored as 20 raw bytes inside the <code>pieces</code> field — not hex strings.</p>
</div>

## Lists

Format: `l<item1><item2>...e`. Parse items until `e` (end), using a dynamic array.

```c
// l4:spami42ee → ["spam", 42]
// lli1ei2eeli3ei4eee → [[1, 2], [3, 4]]
```

## Dictionaries

Format: `d<key1><value1>...e`. Keys **must** be byte strings in **lexicographic order** (spec requirement).

```c
// d3:cow3:moo4:spam4:eggse → {"cow":"moo","spam":"eggs"}
```

<div class="callout spark">
<div class="callout-title">Why Sorted Keys?</div>
<p>The spec requires dictionary keys in lexicographic order. This makes the bencoded bytes of the info dict canonical — everyone with the same torrent produces the exact same bytes, and therefore the exact same SHA-1 info hash. Without sorted keys, the info hash would be inconsistent across implementations.</p>
</div>

## Memory Model

Each `BencodeNode` is heap-allocated. String nodes point directly into the input buffer (zero-copy). Dicts copy keys to null-terminated C strings for easy `strcmp`. Call `bencode_free()` to walk and free the tree.

## Key Functions

| Function | What it does |
|----------|-------------|
| `bencode_parse()` | Entry point — parses a full buffer |
| `bencode_dict_get()` | Looks up a key in a dict node |
| `bencode_print()` | Debug: pretty-prints the tree |
| `bencode_free()` | Recursively frees all nodes |

## Try It

Parse these by hand before running the code:

1. `d6:lengthi12345e4:name8:test.txte`
2. `l3:fooli1ei2ei3eee`
3. `i-99e`

Run `make test` — the 38 bencoding tests will verify your understanding.
