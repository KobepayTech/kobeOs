# KobeOS Master Specification — 172-item implementation checklist

Status: implemented in the KobeOS monorepo. This document is the release traceability index; detailed behavior is verified by the automated acceptance suite for items 159–172 and by the repository build/type/lint gates.

## Evidence map

| Scope | Primary implementation |
| --- | --- |
| 1–16 Business, property, catalogue, posting | `server/src/commerce/*`, `src/apps/kobe-commerce/*`, `src/public/CommercialClaim.tsx` |
| 17–50 Jumla, Lite, live node, Cars | `server/src/commerce/*`, `src/public/Jumla.tsx`, `src/public/LiteStore.tsx` |
| 51 Hotel foundation | `server/src/hotel/*`, `server/src/hotel-public/*`, `src/apps/kobe-hotel/*` |
| 52–68 Lala and customer passport | `server/src/lala/*`, `src/public/Lala.tsx`, `src/public/LalaPassport.tsx` |
| 69–81 payment intelligence and Accountant | `server/src/mobile-money/*`, `server/src/accountant/*`, `server/src/hotel/hotel-operations.*`, `src/apps/kobe-accountant/*` |
| 82–129 Transit, fees, compliance and future foundations | `server/src/transit/*` |
| 130–148 entities, events, notifications, security and audit | module entity files, `server/src/platform/*`, access controls and append-only audit services |
| 149–158 delivery phases | the corresponding completed scopes above and migrations `1783500000000` / `1783600000000` |
| 159–172 acceptance criteria | `server/test/master-spec-acceptance.e2e-spec.ts` |

## Requirement ledger

- [x] 1. Core Ecosystem Principle
- [x] 2. One Business, One Catalogue
- [x] 3. Merchant Website
- [x] 4. Business vs Location
- [x] 5. Product Purpose
- [x] 6. Landlord Setup
- [x] 7. Tenant Claims Shop
- [x] 8. Existing KobeOS User
- [x] 9. Non-KobeOS Merchant
- [x] 10. Merchant States
- [x] 11. Categories
- [x] 12. Product Posting Philosophy
- [x] 13. AI Extraction
- [x] 14. Collage Splitting
- [x] 15. Multiple Images
- [x] 16. Quick Add Integration
- [x] 17. Product Name — Jumla
- [x] 18. Jumla Purpose
- [x] 19. Default Experience
- [x] 20. Property Discovery
- [x] 21. Retail Swipe UX
- [x] 22. Universal Buy Button
- [x] 23. Product Card
- [x] 24. Cart Details
- [x] 25. Valid Order Definition
- [x] 26. Order Statuses
- [x] 27. One Merchant, Multiple Items
- [x] 28. Multi-Shop Cart
- [x] 29. Lite Storefront
- [x] 30. Lite Restrictions
- [x] 31. Free Order Limit
- [x] 32. Order Quota Example
- [x] 33. Quota Warnings
- [x] 34. Beyond 50
- [x] 35. Upgrade
- [x] 36. Full KobeOS Users Must Be Online
- [x] 37. Lite Exception
- [x] 38. Heartbeat
- [x] 39. Jumla Snippet Index
- [x] 40. Live Buy
- [x] 41. Jumla Cars
- [x] 42. Feed
- [x] 43. Dealership Inventory
- [x] 44. Car Posting
- [x] 45. Vehicle Fields
- [x] 46. AI Marketing Content
- [x] 47. Car Search
- [x] 48. Car Buy
- [x] 49. Vehicle Status
- [x] 50. Dealer Economics
- [x] 51. Current Hotel Foundation
- [x] 52. Product — Lala
- [x] 53. Hotel Listing
- [x] 54. Lala Booking
- [x] 55. Lala Hotel Exchange
- [x] 56. Reverse Booking
- [x] 57. Last-Minute Deals
- [x] 58. Verified Availability
- [x] 59. Verified Reviews
- [x] 60. Corporate, Agents and Groups
- [x] 61. Two Loyalty Systems
- [x] 62. Hotel Loyalty
- [x] 63. Lala Rewards
- [x] 64. Separate Balances
- [x] 65. Lala Passport
- [x] 66. Passport Fields
- [x] 67. Privacy
- [x] 68. Passport QR
- [x] 69. Kobe Payment Listener
- [x] 70. Parsed Information
- [x] 71. Matching
- [x] 72. Product Name — Kobe Accountant
- [x] 73. Role
- [x] 74. Daily Reconciliation
- [x] 75. Sales and Expense Confirmation
- [x] 76. Ten-Minute Escalation
- [x] 77. AI Phone Call
- [x] 78. Call System
- [x] 79. Correct Accounting Classification
- [x] 80. Daily Close
- [x] 81. Financial Statements
- [x] 82. Product Name — KobeOS Transit
- [x] 83. Public Display
- [x] 84. Transit Purpose
- [x] 85. Bus Registration
- [x] 86. License Plate Is a Primary Compliance Identifier
- [x] 87. Bus vs Trip
- [x] 88. Transit Board
- [x] 89. ANPR Cameras
- [x] 90. Camera Tracking
- [x] 91. Actual Departure
- [x] 92. ETA Engine
- [x] 93. Trip Following
- [x] 94. Pickup Alert
- [x] 95. Mandatory Bus Fee
- [x] 96. Example Fee Distribution
- [x] 97. Fee Is Attached to Bus/Plate
- [x] 98. Compliance States
- [x] 99. Automatic Status Update
- [x] 100. Payment Methods
- [x] 101. Fleet Payment
- [x] 102. Operator Fee Dashboard
- [x] 103. Payment Reminders
- [x] 104. ANPR Compliance Check
- [x] 105. Paid Bus Detection
- [x] 106. Unpaid Bus Detection
- [x] 107. Enforcement Notification
- [x] 108. Enforcement Authority Boundary
- [x] 109. Real-Time Payment After Detection
- [x] 110. Government Overview
- [x] 111. Government Filters
- [x] 112. Government Drilldown
- [x] 113. Revenue Settlement
- [x] 114. Settlement Reports
- [x] 115. Government Payment Ledger
- [x] 116. Plate Payment History
- [x] 117. Plate Change
- [x] 118. Bus Sale / Operator Change
- [x] 119. Off-Road Status
- [x] 120. Exemptions
- [x] 121. Payment Dispute
- [x] 122. ANPR Error
- [x] 123. Operational Analytics
- [x] 124. Compliance Analytics
- [x] 125. Camera Analytics
- [x] 126. GPS
- [x] 127. Ticketing
- [x] 128. Jumla Transport
- [x] 129. Cargo/Fleet Reuse
- [x] 130. Commerce Entities
- [x] 131. Cars Entities
- [x] 132. Lala Entities
- [x] 133. Accounting Entities
- [x] 134. Transit Entities
- [x] 135. Commerce Events
- [x] 136. Hotel/Lala Events
- [x] 137. Accounting Events
- [x] 138. Transit Events
- [x] 139. Shared Notification Service
- [x] 140. Jumla Notifications
- [x] 141. Transit Operator Notifications
- [x] 142. Transit Passenger Notifications
- [x] 143. Enforcement Notifications
- [x] 144. Merchant Privacy
- [x] 145. Accounting Audit
- [x] 146. Transit Compliance Audit
- [x] 147. Government Access
- [x] 148. Payment Security
- [x] 149. Phase 1 — Commercial Property
- [x] 150. Phase 2 — Product Posting
- [x] 151. Phase 3 — Jumla Retail
- [x] 152. Phase 4 — Lite Conversion
- [x] 153. Phase 5 — Live KobeOS Network
- [x] 154. Phase 6 — Jumla Cars
- [x] 155. Phase 7 — Lala
- [x] 156. Phase 8 — Kobe Accountant
- [x] 157. Phase 9 — Transit Core
- [x] 158. Phase 10 — Transit Fees and Compliance
- [x] 159. Property Test
- [x] 160. Collage Test
- [x] 161. Jumla Order Test
- [x] 162. Lite Quota Test
- [x] 163. Node Offline Test
- [x] 164. Car Test
- [x] 165. Accountant Test
- [x] 166. Transit Tracking Test
- [x] 167. Transit Fee Test
- [x] 168. Fleet Payment Test
- [x] 169. Overdue Camera Test
- [x] 170. Payment After Alert Test
- [x] 171. Low-Confidence ANPR Test
- [x] 172. Government Settlement Test

## Release gate

The checklist is considered releasable only when all of these commands pass from the repository root:

```text
npm run typecheck
npm run lint
npm run build:frontend
npm run build --prefix server
npm run test:e2e --prefix server -- master-spec-acceptance.e2e-spec.ts --runInBand
```
