---
layout:      chapter
title:       "Piece Management & Assembly"
short_title: "Piece Management"
project:     "btorrent"
order:       6
version:     "Core Protocol"
summary:     "State machine, SHA-1 verify, writing to disk"
description: "The piece manager is the stateful core of the client — tracking which pieces and blocks have arrived, verifying integrity with SHA-1, and writing verified pieces to the output file."

tags:
  - Systems
  - Disk I/O
  - SHA-1
  - State Machine
---

## The Big Picture

Coordinating a download means answering these questions continuously:

- Which pieces do we still need?
- Which peers have which pieces?
- Which 16 KiB blocks within an active piece have arrived?
- When a piece is complete, does it verify?
- Where in the output file does each piece land?

This is the **piece manager's** job.

## Piece vs Block

Important distinction:

| Term | Definition | Typical Size |
|------|-----------|-------------|
| **Piece** | Unit defined in the torrent file | 256 KiB – 2 MiB |
| **Block** | Unit you request from a peer | Always 16,384 bytes |

A 256 KiB piece requires 16 block requests. You only SHA-1 verify the complete assembled piece, never individual blocks.

## Piece States

```c
typedef enum {
    PIECE_EMPTY,    // not started — no buffer allocated
    PIECE_ACTIVE,   // downloading — buffer allocated, blocks arriving
    PIECE_COMPLETE, // verified and written — buffer freed
} PieceState;
```

Each piece tracks:

```c
typedef struct {
    PieceState state;
    uint8_t   *data;           // piece data buffer (NULL unless ACTIVE)
    int        piece_length;   // actual byte length of this piece
    uint8_t   *block_received; // bool[num_blocks]: which blocks arrived
    int        num_blocks;     // ceil(piece_length / BLOCK_SIZE)
    int        blocks_done;
} PieceStatus;
```

## Receiving a Block

When a `MSG_PIECE` arrives:

```c
int on_block_received(PieceManager *pm, int piece_idx,
                      int begin, const uint8_t *data, int len) {
    PieceStatus *ps = &pm->pieces[piece_idx];

    // Activate piece buffer on first block
    if (ps->state == PIECE_EMPTY) {
        ps->data  = malloc(ps->piece_length);
        ps->state = PIECE_ACTIVE;
    }

    // Copy block data into correct offset
    memcpy(ps->data + begin, data, len);

    // Mark block received
    int block_idx = begin / BLOCK_SIZE;
    if (!ps->block_received[block_idx]) {
        ps->block_received[block_idx] = 1;
        ps->blocks_done++;
    }

    // Check if all blocks arrived
    if (ps->blocks_done == ps->num_blocks) {
        return verify_and_write(pm, piece_idx);
    }
    return 0;
}
```

## SHA-1 Verification

When all blocks arrive, verify the complete piece:

```c
int verify_piece(const TorrentInfo *t, int idx,
                 const uint8_t *data, int len) {
    uint8_t computed[20];
    sha1(data, len, computed);

    const uint8_t *expected = t->pieces_hash + (idx * 20);
    return memcmp(computed, expected, 20) == 0;
}
```

If verification **fails**:
- Reset the piece to `PIECE_EMPTY`
- Free the buffer
- Clear `block_received`
- The piece will be re-requested from another peer

<div class="callout ok">
<div class="callout-title">Security Without a Central Authority</div>
<p>Any peer — even a malicious one — can send you data. The SHA-1 check catches any tampering or corruption before it ever reaches disk. The torrent file's <code>pieces</code> field is the ground truth, and you trusted it when you opened the torrent.</p>
</div>

## Writing to Disk

Pre-allocate the output file at full size on startup:

```c
// Sparse file: seek to last byte, write one zero
fseek(out_file, torrent->total_length - 1, SEEK_SET);
fputc(0, out_file);
```

Then write verified pieces by seeking to their offset:

```c
void write_piece(PieceManager *pm, int piece_idx) {
    long offset = (long)piece_idx * pm->torrent->piece_length;
    fseek(pm->out_file, offset, SEEK_SET);
    fwrite(ps->data, 1, ps->piece_length, pm->out_file);
    fflush(pm->out_file);

    // Free buffer — no longer needed in memory
    free(ps->data);
    ps->data  = NULL;
    ps->state = PIECE_COMPLETE;
    pm->completed++;
}
```

Pre-allocating lets you write pieces in any order. On modern filesystems (ext4, APFS, NTFS), the sparse file uses no actual disk space until data is written.

## Piece Selection: Sequential

btorrent uses **sequential** selection — always download the lowest-numbered needed piece:

```c
int next_piece(PieceManager *pm, const uint8_t *peer_bitfield) {
    for (int i = 0; i < pm->num_pieces; i++) {
        if (pm->pieces[i].state != PIECE_EMPTY) continue;
        if (peer_bitfield && !has_piece(peer_bitfield, i)) continue;
        return i;
    }
    return -1;  // nothing needed from this peer
}
```

Real clients use **rarest-first** — prefer pieces that fewer peers have. This improves overall swarm health by distributing rare pieces faster.

## Progress Display

```c
void print_progress(const PieceManager *pm) {
    int total   = pm->num_pieces;
    int done    = pm->completed;
    int percent = done * 100 / total;
    int filled  = done * 40 / total;

    printf("\r[");
    for (int i = 0; i < 40; i++) printf(i < filled ? "#" : ".");
    printf("] %3d%% (%d/%d pieces)", percent, done, total);
    fflush(stdout);
}
```

## Memory Considerations

Never keep all pieces in RAM simultaneously. A 10 GB torrent with 256 KiB pieces = 40,000 pieces × 256 KiB = 10 GB. Instead:

- Allocate a piece buffer only when we start downloading it (`PIECE_ACTIVE`)
- Free immediately after writing to disk (`PIECE_COMPLETE`)
- At any moment, only the pieces currently being downloaded are in RAM

## Summary

The full download lifecycle:

```
parse torrent → announce to tracker → for each peer:
  connect → handshake → send interested → wait for unchoke
  loop:
    pick next needed piece the peer has
    send 5 pipelined block requests
    as each MSG_PIECE arrives:
      store block in piece buffer
      send next request
      if piece complete → SHA-1 verify
        pass  → write to disk, free buffer, mark COMPLETE
        fail  → reset to EMPTY, retry from another peer
    until all pieces COMPLETE
```

Congratulations — you've read the full BTorrent protocol stack from bits to bytes to files.
