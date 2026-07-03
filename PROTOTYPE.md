# Idle Vehicle Nudge — Prototype Documentation

**Product:** Kazam EV Charging App  
**Pilot:** OCPP 1.6J  
**Status:** Interactive prototype — not production code

---

## What is this?

When an EV finishes charging at a Kazam station, the car continues to occupy the bay even though it no longer needs power. This blocks other drivers who need to charge. The **Idle Nudge** feature is a mechanism to nudge the occupying driver to unplug and free the bay — without confrontation, without revealing who is waiting, and without requiring staff intervention.

This prototype simulates the full interaction across two phones simultaneously: the **waiting driver** (wants to charge) and the **occupying driver** (car is done charging but still plugged in).

---

## The Two Roles

### Waiting Driver
A driver who has arrived at the station, found the bay occupied, and is waiting for it to free up. They can see the charger status in the Kazam app and, after a grace period, send an anonymous nudge to the occupying driver.

### Occupying Driver
A driver whose EV has finished charging but whose car remains plugged in. They receive system reminders and nudges from waiting drivers, and can send a quick reply via the app.

---

## Business Logic

### Charger States (OCPP 1.6J Signals)
| Signal | Meaning |
|---|---|
| `charging` | Car is actively drawing power |
| `finishing` | Charging complete, car still plugged in — idle time begins |
| `available` | Gun removed, bay is free |
| `offline` | Charger unreachable — nudge feature disabled |

### Timeline
| Milestone | Time | Event |
|---|---|---|
| T | 0:00 | Charging stops. System logs first entry: *"Please remove your charger"* |
| T+5 | 5:00 | Second automated system reminder sent to occupying driver |
| T+10 | 10:00 | Waiting drivers become eligible to send manual nudges |
| T+20 | 20:00 | Waiting driver can escalate by contacting support |

### Nudge Eligibility Gates
A waiting driver can only send a nudge if **all** of the following are true:
- Their session is marked **eligible** (not a guest, not blocked)
- They are **within 100 metres** of the charger (geofence)
- The connector state is `finishing` (car still plugged in)
- At least **10 minutes** have passed since charging stopped (T+10)
- The **cooldown** has expired — at least 5 minutes since the last message from any party

### Many-to-One Conversation Model
- All waiting drivers at a bay share **one anonymous thread**
- The sender's identity is never surfaced — not to the occupying driver, not to other waiting drivers
- The occupying driver sees all nudges as coming from "a waiting driver"
- The occupying driver can send **one reply per reminder window**

### Gun Removal
- Unplugging is a **physical action** detected automatically via OCPP (`available` packet)
- There is no "I've unplugged" button in the app
- On gun removal: the conversation thread is discarded, all state resets

### Support Escalation
- At T+20, the waiting driver gets a **"Contact support"** button
- Tapping it logs a system message: *"A driver is waiting — support will call you"*
- Support calls the occupying driver directly to request they move the vehicle

---

## Functional Logic

### Shared Simulation State
Both phones read from and write to a single shared state object, so any action on either phone is immediately reflected on the other. This is managed via React's `useReducer`.

```
{
  running: bool,         // simulation clock running
  speed: number,         // sim speed multiplier (1×, 4×, 8×, 16×, 32×)
  idleSec: number,       // negative = still charging; 0 = T; positive = idle seconds
  connector: string,     // charging | finishing | available | offline
  eligible: bool,        // waiting driver eligibility flag
  inRange: bool,         // waiting driver within 100m geofence
  lastMsgSec: number,    // idleSec when last message was sent (for cooldown)
  sysNudged: bool,       // T+5 system reminder has fired
  supportCalled: bool,   // waiting driver has escalated to support
  bReply: string|null,   // occupying driver's reply text
  log: [],               // shared conversation thread entries
}
```

### Message Types in the Thread
| Kind | Sender | Shown as |
|---|---|---|
| `system` | Kazam platform | Centred grey pill |
| `wait` | Waiting driver | Right bubble (purple) on waiting driver's screen; left bubble on occupying driver's screen |
| `occupier` | Occupying driver | Right bubble (purple) on occupying driver's screen; left bubble on waiting driver's screen |

### Message Text
- **Waiting driver sends:** *"Hey! please remove your vehicle"*
- **Occupying driver receives:** *"A driver is waiting please remove your vehicle"*  
  *(same log entry, different label per perspective)*
- **System at T+0 and T+5:** *"Please remove your charger"*
- **Support escalation:** *"A driver is waiting — support will call you"*

### Occupying Driver Quick Replies
The occupying driver can reply with pre-set ETAs once a nudge has been received. Tapping a reply selects it; a **Send** button then confirms. After sending, the reply is appended to the shared thread and visible to waiting drivers.

---

## Prototype Controls (Control Panel)

The left sidebar is a simulation control panel not present in the real product. It allows the tester to:

| Control | Purpose |
|---|---|
| **Charger signal** | Manually set the OCPP connector state |
| **Simulate gun removal** | Fires the `available` packet, clears the thread, resets both screens |
| **Timeline scrubber** | Jump to any point in time (T−1min to T+24min) |
| **Milestone pills** | Jump directly to T, T+5, T+10, T+20 |
| **Play / Pause** | Run or pause the simulation clock |
| **Speed (1×–32×)** | Fast-forward the simulation |

---

## Screen Flows

### Waiting Driver
```
Kazam Home (map + charger card)
  └── Charger card tap / Nudge button → Conversation + nudge screen
        └── Back button → Kazam Home
```

### Occupying Driver
```
Charging screen (100% ring, session info)
  └── [Auto at T+0] → Remove connector screen (amber reminder)
        └── [Nudge received] → Urgent screen (red alert, reply options)
              └── Reply selected → Send → Confirmation
        └── [Gun removed via OCPP] → Thank you screen → Reset
```

---

## What This Prototype Is Not

- Not a production build — no real OCPP server, no real user accounts
- The geofence and eligibility toggles are manual overrides for demo purposes
- The conversation is local state — it does not persist or sync across real devices
- Support escalation does not actually place a phone call
