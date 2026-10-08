---
"@toad-contracts/frontend-http-client": patch
---

Leave a query param whose value is `undefined` out of the URL instead of sending it as an empty parameter (`?key=`), which an optional field in the query schema refused on the server.
