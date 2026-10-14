# Reserved seating (pick exact seats)

## How an organiser sets it up (admin)
1. **Venues → (venue) → Seating plan.** Add one section per block of seats, e.g. Stalls, Balcony.
   Each section = a short **code** (A, BAL), a **name** (shown to buyers), **rows**, **seats per row**
   and the letter of the **first row** (rows continue A, B, C …). Optional: **aisle after** (seat numbers
   after which a walkway is drawn, e.g. `6, 18`) and **unavailable** seats (row + number, e.g. `A1, F7`).
2. **Events → (event) → Tickets tab → Seating = Reserved seats** (the event must use that venue).
3. Create one **ticket tier per price** and, in each tier, fill **Seating sections sold by this tier**
   with the section codes it covers, e.g. tier "Stalls 300 SEK" → `A`; tier "Balcony 150 SEK" → `B`.
   The tier's *quantity* is ignored: a tier sells exactly the seats of its sections.
   A section that no tier lists cannot be sold (shown as taken).
4. Publish. Buyers now see a seat map instead of quantity buttons.

## What the buyer sees
Tickets step = seat map (free / your choice / taken, price per section). Up to *Max per order* seats.
Continue → buyer details → services → payment, exactly like general admission. When they press
Buy now the chosen seats are **held for the 10-minute timer** (the same hold time as ordinary tickets).
If someone else got a seat first, the buyer is told, the map refreshes and nothing is charged.
After payment the seats are **sold**. If the payment is abandoned or the timer ends, the seats go back on sale.

## Tickets and gate
Every ticket has its own QR **and shows its seat** (ticket picture, PDF, thank-you page, My tickets,
emails). When staff scan a QR the full-screen result shows the **seat** ("Stalls · Row B · Seat 4"); the
approved list, manual search and the attendee CSV include it too. A refunded or cancelled ticket frees its seat.

## How it works inside (for developers)
* `apps/api/src/seating.ts` — plan → seats, tier lookup, seat holds. One document per taken seat in
  `booking_seats`, keyed `<eventId>|<seatId>`; the unique key makes double-selling impossible.
* Checkout (`POST /checkout`) accepts `seats: ["A:B:4", …]` for reserved events; the server prices
  each seat from its tier and ignores any client-sent price. Availability (`GET /events/:id/availability`)
  returns the seat map with each seat's state.
* A payment that arrives after the hold expired wins the seats back only if nobody took them; otherwise it is refunded.
* Not covered yet: complimentary / box-office tickets created by staff are not seat-assigned; saved carts do not hold seats.
