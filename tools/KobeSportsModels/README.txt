KobeSports Models Setup

1. Extract this ZIP.
2. Open Command Prompt as a normal user.
3. Run one of:

   setup_kobesports_models.cmd lite
   setup_kobesports_models.cmd balanced
   setup_kobesports_models.cmd full

Recommended:
   setup_kobesports_models.cmd balanced

Destination:
   C:\KobeOS\Models\Sports

Profiles:
- lite: lower storage and faster CPU/edge inference
- balanced: recommended for a GPU workstation/server
- full: also downloads depth and oriented-box foundations

The installer creates one shared copy of the weights and per-sport model-map.json
files for football, boxing, basketball, volleyball, MMA, tennis, cricket,
athletics, and motorsport.

Important:
The downloaded files are pretrained foundation models. They are not already
trained to detect every sport-specific class. Each sport folder includes a
classes.txt and a custom folder showing the custom weights still required.
