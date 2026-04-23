---
layout:      chapter
title:       "Peer Wire Protocol"
short_title: "Peer Protocol"
project:     "btorrent"
order:       5
version:     "Core Protocol"
summary:     "TCP handshake, message framing, block requests"
description: "The peer wire protocol is how two BitTorrent clients exchange data over TCP. This chapter covers the 68-byte handshake, message framing, the choke/unchoke flow, and how to request and receive piece blocks."

tags:
  - Networking
  - TCP Sockets
  - Protocols
  - BitTorrent
---

## Overview

Once you have peer addresses from the tracker, you connect to them via **TCP** and exchange messages to download pieces. The protocol has two phases:

1. **Handshake** — establish identity and verify you want the same torrent
2. **Message exchange** — request and receive piece data

## Phase 1: The 68-Byte Handshake

The handshake is the first thing sent on a new connection. It is **not** a length-prefixed message — it has its own fixed format:

| Offset | Size | Field | Value |
|--------|------|-------|-------|
| 0 | 1 | pstrlen | 19 |
| 1 | 19 | pstr | `"BitTorrent protocol"` |
| 20 | 8 | reserved | `0x0000000000000000` |
| 28 | 20 | info_hash | SHA-1 of the info dict |
| 48 | 20 | peer_id | our 20-byte client ID |

Total: **68 bytes**.

```c
void build_handshake(uint8_t *buf, const uint8_t *info_hash,
                     const uint8_t *peer_id) {
    buf[0] = 19;                                   // pstrlen
    memcpy(buf + 1,  "BitTorrent protocol", 19);   // pstr
    memset(buf + 20, 0, 8);                        // reserved
    memcpy(buf + 28, info_hash, 20);               // info_hash
    memcpy(buf + 48, peer_id,   20);               // peer_id
}
```

After sending, read back 68 bytes. Verify:
- `pstr` is `"BitTorrent protocol"` (wrong protocol → disconnect)
- `info_hash` matches yours (different torrent → disconnect)

## Phase 2: Message Framing

All post-handshake messages share this format:

```
[length 4B big-endian][id 1B][payload variable]
```

- `length = 0` → keep-alive (no id byte)
- `length = 1` → no payload messages (choke, unchoke, interested, uninterested)
- Read length first, then read exactly `length` more bytes

```c
// Reliable receive — loops until all bytes arrive
static int recv_all(int sock, uint8_t *buf, size_t len) {
    size_t received = 0;
    while (received < len) {
        ssize_t n = recv(sock, buf + received, len - received, 0);
        if (n <= 0) return -1;
        received += n;
    }
    return 0;
}
```

## Message Types

| ID | Name | Payload | Meaning |
|----|------|---------|---------|
| — | keep-alive | none (len=0) | Heartbeat |
| 0 | choke | none | I won't send you data |
| 1 | unchoke | none | I will send you data |
| 2 | interested | none | I want data from you |
| 3 | uninterested | none | I don't want data |
| 4 | have | 4B index | I finished piece N |
| 5 | bitfield | N bytes | Which pieces I have |
| 6 | request | 12B | Send me block [index, begin, len] |
| 7 | piece | 8B + data | Here is your block data |
| 8 | cancel | 12B | Cancel that request |

## Choking and Unchoking

You start **choked** by every peer — they won't send you data until they unchoke you.

```
You → MSG_INTERESTED
Peer → MSG_UNCHOKE        (hopefully — may not come immediately)
You → MSG_REQUEST(...)
Peer → MSG_PIECE(...)
```

The real BitTorrent "tit-for-tat" algorithm unchokes peers who upload to you. For our simple client, we wait to be unchoked and move on if it doesn't happen.

## The Bitfield Message

Usually the first message after the handshake. Tells you which pieces the peer has:

```
Byte 0, bit 7 = piece 0
Byte 0, bit 6 = piece 1
...
Byte 1, bit 7 = piece 8
```

```c
int has_piece(const uint8_t *bitfield, int piece_index) {
    int byte_idx = piece_index / 8;
    int bit_idx  = 7 - (piece_index % 8);  // MSB first
    return (bitfield[byte_idx] >> bit_idx) & 1;
}
```

## Requesting Blocks

Pieces are downloaded in **blocks** of 16,384 bytes (16 KiB) — this is the standard block size. Never request a full piece at once.

The `request` message (12 bytes payload):

```c
// [index 4B][begin 4B][length 4B] — all big-endian
int peer_send_request(PeerConn *conn, uint32_t index,
                      uint32_t begin, uint32_t length) {
    uint8_t buf[17];
    write_uint32_be(buf,      13);          // payload length
    buf[4] = MSG_REQUEST;
    write_uint32_be(buf + 5,  index);
    write_uint32_be(buf + 9,  begin);
    write_uint32_be(buf + 13, length);
    return send_all(conn->sock, buf, 17);
}
```

## Pipelining

Don't wait for each block before requesting the next — send multiple requests before reading replies. btorrent uses a pipeline depth of 5:

```
→ request(piece=2, begin=0,     len=16384)
→ request(piece=2, begin=16384, len=16384)
→ request(piece=2, begin=32768, len=16384)
→ request(piece=2, begin=49152, len=16384)
→ request(piece=2, begin=65536, len=16384)
← piece(2, 0,     data...)
→ request(piece=2, begin=81920, len=16384)  ← send next as soon as one arrives
← piece(2, 16384, data...)
...
```

<div class="callout spark">
<div class="callout-title">Why Pipeline?</div>
<p>Without pipelining: send request → wait for round-trip → send next request. With pipelining: keep the network pipe full. On a 50ms latency connection, pipelining 5 requests gives ~5× throughput vs serial requests.</p>
</div>

## TCP Socket Setup in C

```c
int sock = socket(AF_INET, SOCK_STREAM, 0);

// Set 5-second connect/recv timeout
struct timeval timeout = { .tv_sec = 5 };
setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));

struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_port   = htons(peer_port),
};
inet_pton(AF_INET, peer_ip, &addr.sin_addr);

connect(sock, (struct sockaddr *)&addr, sizeof(addr));
```

## Connection State Machine

```
CONNECTING
    ↓  TCP connect()
HANDSHAKING  →  send 68B, recv 68B, verify info_hash
    ↓
INTERESTED   →  send MSG_INTERESTED
    ↓
WAITING      →  loop reading messages until MSG_UNCHOKE
    ↓
DOWNLOADING  →  pipeline MSG_REQUEST, receive MSG_PIECE
    ↓
DONE         →  close()
```
