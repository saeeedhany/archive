---
layout:      chapter
title:       "HTTP Tracker Protocol"
short_title: "Tracker Protocol"
project:     "btorrent"
order:       4
version:     "Core Protocol"
summary:     "Announce to trackers, parse compact peer lists"
description: "The tracker is an HTTP rendezvous service — it knows who's downloading each torrent and hands out peer addresses. This chapter covers the announce request, compact peer format, and re-announce logic."

tags:
  - Networking
  - HTTP
  - Tracker
  - URL Encoding
---

## What Is a Tracker?

A tracker is an HTTP server that maintains a list of peers for each torrent. When you start downloading, you tell the tracker:

> "I'm downloading torrent X. Here's my ID. Who else is downloading it?"

The tracker replies with IP addresses and ports you can connect to directly. The tracker does **not** hold the files — it's a pure directory service.

## The Announce Request

```
GET /announce
  ?info_hash=<20 url-encoded bytes>
  &peer_id=<20 url-encoded bytes>
  &port=6881
  &uploaded=0
  &downloaded=0
  &left=<bytes remaining>
  &compact=1
  &event=started
```

### URL Encoding the Info Hash

The 20-byte info hash must be percent-encoded. Each byte becomes `%XX` unless it's an RFC 3986 unreserved character (letters, digits, `-`, `_`, `.`, `~`).

```c
void url_encode_bytes(const uint8_t *bytes, size_t len, char *out) {
    for (size_t i = 0; i < len; i++) {
        uint8_t b = bytes[i];
        if (isalnum(b) || b=='-' || b=='_' || b=='.' || b=='~') {
            *out++ = (char)b;
        } else {
            out += sprintf(out, "%%%02X", b);
        }
    }
    *out = '\0';
}
```

### The Peer ID

A 20-byte client identifier. Convention (BEP 20 "Azureus-style"):

```
-BT0001-xxxxxxxxxxxx
 ^^^^^^  12 random alphanumeric bytes
 Client code + version
```

```c
void generate_peer_id(uint8_t *out) {
    const char *prefix = "-BT0001-";
    memcpy(out, prefix, 8);
    // Fill remaining 12 with random alphanumeric
    for (int i = 8; i < 20; i++) {
        out[i] = charset[rand() % sizeof(charset)];
    }
}
```

## The Tracker Response

The tracker responds with a bencoded dictionary:

### Success

```
d
  8:interval    → i1800e        (seconds between re-announces)
  5:peers       → <compact list>
e
```

### Failure

```
d
  14:failure reason → "torrent not found"
e
```

## Compact Peer Format

With `compact=1`, each peer is exactly **6 bytes**: 4 bytes IPv4 + 2 bytes port (big-endian).

```c
// Parse compact peers
for (int i = 0; i < peers_len; i += 6) {
    uint8_t *p = peers_data + i;

    char ip[16];
    snprintf(ip, 16, "%d.%d.%d.%d", p[0], p[1], p[2], p[3]);

    uint16_t port = ((uint16_t)p[4] << 8) | p[5];  // big-endian!
}
```

<div class="callout info">
<div class="callout-title">Why Compact?</div>
<p>Compact format encodes each peer in 6 bytes vs ~50 bytes for the dictionary format (which sends full IP strings and field names). For 200 peers, that's 1.2 KB vs 10 KB — significant for a tracker serving millions of requests.</p>
</div>

## Re-Announcing

The `interval` field tells you when to re-announce (typically 30 minutes). Send `event=stopped` when you quit, `event=completed` when the download finishes.

## Implementation Notes

btorrent uses **libcurl** only for the tracker HTTP GET — the only external dependency. Everything else is raw sockets.

```c
CURL *curl = curl_easy_init();
curl_easy_setopt(curl, CURLOPT_URL, url);
curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_write_cb);
curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
curl_easy_perform(curl);
```

## Multiple Trackers

`announce-list` is a list of lists (tiers). Try each tier in order, shuffle within tiers:

```
announce-list: [
  ["http://tracker1.com/announce"],  ← tier 1
  ["udp://tracker2.com:6969"]        ← tier 2 (fallback)
]
```

Only move to the next tier if all trackers in the current tier fail.
