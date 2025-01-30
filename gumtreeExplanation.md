Below is an explanation of each main function (and class) in the JavaScript version of gummiebot—what it does, how it works, and how they all tie together to accomplish the same logic as the original Python code.

Overall Workflow
	1.	Command-Line Entry
The script begins by reading process.argv to parse the user’s requested command (e.g., "post", "delete", "refresh", or "repost") and one or more directories.
	2.	Login
The script prompts you for your Gumtree username and password. It then logs in to Gumtree using those credentials.
	3.	Directory Processing
For each directory you specify on the command line, the script:
	•	Reads the directory’s meta.gummie.json to create a GumtreeListing.
	•	Depending on the command, performs the associated action on that listing (e.g., posts the ad, deletes it, etc.).
	4.	Output
It logs status messages to the console (mostly to stderr), letting you know how each ad was processed.

Detailed Explanations

1. GummieSession

class GummieSession {
  constructor() {
    this._axios = axios.create({
      withCredentials: true
    });
  }

  async get(name, url, config = {}) { ... }
  async post(name, url, data = {}, config = {}) { ... }
}

Purpose
	•	Mimics Python’s requests.Session concept by maintaining cookies across requests.
	•	Provides a consistent place to inject a random delay before any HTTP request. This delay is meant to simulate a more “human” usage pattern (the Python code has a @wait decorator).

Key Points
	•	Uses axios as its HTTP client.
	•	withCredentials: true ensures cookies are preserved between requests.
	•	On each get() or post() call:
	1.	Logs a short message (e.g., "Posting login details...").
	2.	Awaits a random delay of 1 to 3 seconds before sending the request.
	3.	Returns the axios response object (or throws an error if the request fails).

2. GummieBot

class GummieBot {
  static BASE_URL = 'https://www.gumtree.com.au/';

  constructor(username, password) { ... }
  async login() { ... }
  async delete_ad_by_id(adId) { ... }
  async delete_ad_by_name(name) { ... }
  async post_ad(ad) { ... }
  async getCategoryMap() { ... }
  async category_name_to_id(categoryName) { ... }
  async getAds() { ... }
}

Purpose
	•	Represents the main interface for interacting with Gumtree:
	•	Logging in
	•	Deleting ads
	•	Posting ads
	•	Retrieving categories and existing ads

Key Methods
	1.	constructor(username, password)
	•	Saves the given credentials and instantiates a GummieSession.
	•	The actual login happens when you call login() separately.
	2.	async login()
	•	Retrieves the Gumtree login page (to get any hidden fields/CSRF tokens).
	•	Parses the form with a GumtreeFormParser to extract required hidden fields.
	•	Submits a POST request with username/password + those hidden form values.
	•	Checks if an error (notification--error) appears, and if so, throws an error.
	•	Otherwise, indicates a successful login.
	3.	async delete_ad_by_id(adId)
	•	Sends a GET request to Gumtree’s m-delete-ad.html endpoint with query params:
	•	adId=...
	•	additional “reason” parameters
	•	Checks if the page returned has a success string ("notification--success").
	•	Returns true if the ad was successfully removed, false otherwise.
	4.	async delete_ad_by_name(name)
	•	Finds the ad ID from the title by calling getAds() (if not already cached).
	•	Uses delete_ad_by_id(adId) to actually delete it.
	5.	async post_ad(ad)
This is the largest method because it replicates the multi-step form logic from the Python version:
	•	Delete drafts
Calls p-post-ad.html?delDraft=true to ensure there are no leftover draft ads.
	•	Go to the “main” form at p-post-ad2.html
Submits basic info: title, categoryId, adType=OFFER, etc.
Returns an HTML page containing the real posting form.
	•	Parse the main form to gather hidden fields (like CSRF tokens, plus any default values).
	•	Gather submission data from both the user’s listing and the hidden fields.
	•	Upload images one by one to p-upload-image.html with FormData.
The response for each image should contain a JSON snippet with the teaserUrl, which is saved.
	•	Post a draft to p-post-draft-ad.html, in case a final submission fails.
	•	Finally submit the ad to p-submit-ad.html.
	•	Returns true if the final page has notification--success, else false.
	6.	async getCategoryMap() / async category_name_to_id(categoryName)
	•	getCategoryMap() fetches the homepage (or a specific categories page), scrapes out a JavaScript snippet of category data:

Gtau.Global.variables.categories = { "id": "1", "name": "...", "children": [...] };


	•	Parses that snippet to build a leaf-only category map, e.g. { "SubCategoryName": 12345, ... }.
	•	Caches it in _category_map for future lookups.
	•	category_name_to_id(categoryName) then looks up a given category name in the map, or suggests the closest match if it’s not found.

	7.	async getAds()
	•	Retrieves the “My Ads” page m-my-ads.html.
	•	Parses the HTML to find <a class="rs-ad-title" href="...adId=XXXX">Title</a>.
	•	Builds a {"Title": "XXXX"} map so that we can delete ads by their title.
	•	Caches that map in _ads.

3. GumtreeFormParser

class GumtreeFormParser {
  constructor(targetId) { ... }
  feed(html) { ... }
  close() { ... }
}

Purpose
	•	Replicates Python’s html.parser approach to find <form id="..."> and gather <input> fields within that form.
	•	In this JS version, we:
	•	Use cheerio to load the HTML.
	•	Find <form id="targetId">, then gather all <input> tags inside.
	•	Store each input’s name, type, value.
	•	close() just returns all the extracted inputs.

Usage
	•	Used in GummieBot.login() to find hidden CSRF tokens or other hidden fields in the login form.
	•	Used in GummieBot.post_ad() to gather hidden fields in the main ad posting form.

4. GumtreeMyAdsParser

class GumtreeMyAdsParser {
  constructor() { ... }
  feed(html) { ... }
  close() { ... }
}

Purpose
	•	Scrapes the user’s “My Ads” page to build a dictionary of { "TitleOfAd": "AdID" }.
	•	Looks specifically for links with class="rs-ad-title", extracts both the ad ID from the URL (adId=XXXX) and the link text (the ad title).

Usage
	•	Called inside GummieBot.getAds().

5. GumtreeListing

class GumtreeListing {
  constructor(title, description, price, category, condition, images) { ... }
  debug() { ... }
}

Purpose
	•	Encapsulates the data for a single listing (ad) you want to post or delete.
	•	Validates things like:
	•	price.amount is a float and > 0
	•	price.type is one of FIXED, NEGOTIABLE, etc.
	•	condition is either used or new
	•	Stores the associated images’ file paths, description, category, etc.

Usage
	•	You create a GumtreeListing by calling gummie_json_parse(), which reads meta.gummie.json plus the description text, plus images.

6. gummie_json_parse(directory)

function gummie_json_parse(directory) {
  // ...
  return new GumtreeListing(...);
}

Purpose
	•	Reads meta.gummie.json inside a given directory.
	•	Extracts:
	•	title
	•	description_file → loads text from that file
	•	price object
	•	category
	•	Optional condition (default = used)
	•	Array of images (checks they exist).
	•	Returns a new GumtreeListing with all that info.

Usage
	•	Called once per directory to build the listing data that will be posted or deleted on Gumtree.
	•	Mimics the Python function.

7. gummie_category_extract(tree, category_map)

function gummie_category_extract(tree, category_map) {
  if (tree.children && tree.children.length > 0) {
    for (let child of tree.children) {
      gummie_category_extract(child, category_map);
    }
  } else {
    category_map[tree.name] = tree.id;
  }
}

Purpose
	•	Recursive function that picks out only leaf categories in a nested JSON object from Gumtree.
	•	Leaf categories are the ones that have no further children.
	•	Used to build a simple map of { "CategoryName": "CategoryID", ... } from a complicated tree structure.

Usage
	•	Invoked in getCategoryMap() to process Gumtree’s category JSON tree.

8. dict_key_else_log_similar(dict_, key, logNoun = 'key')

function dict_key_else_log_similar(obj, key, logNoun = 'key') {
  if (key in obj) {
    return obj[key];
  } else {
    // Suggest close matches using difflib
    ...
  }
}

Purpose
	•	Looks up key in a given dictionary (obj). If it doesn’t exist, tries to guess a close match using the difflib package (similar to Python’s difflib.get_close_matches).
	•	Throws an error with a suggestion if a close match is found.
	•	Returns the exact dictionary value if found.

Usage
	•	Ensures user-typed category names or ad titles are correct. If not found, it helps by giving a “Did you mean ___?” message.
	•	Called inside category_name_to_id(...) and delete_ad_by_name(...).

9. Main Block (if (require.main === module) ...)

if (require.main === module) {
  main().catch(err => { ... });
}

Purpose
	•	Detects if the script is being run directly from Node (rather than being imported as a module).
	•	If so, calls the main() function.
	•	The main() function does:
	1.	Parses command-line arguments (command, directories).
	2.	Prompts for username/password (using prompt-sync).
	3.	Logs in via GummieBot.login().
	4.	For each directory:
	•	Calls gummie_json_parse(directory) to get a GumtreeListing.
	•	Calls the relevant function (delete, post, refresh, or repost) on that listing.
	5.	Logs the result of each operation.

How It All Works Together
	1.	You run:

node gummiebot.js post /path/to/listing1 /path/to/listing2


	2.	Script starts → Enters main().
	3.	Parses the command (post) and directories (listing1, listing2).
	4.	Prompts you for username and password.
	5.	Constructs a GummieBot with those credentials; calls login() to authenticate with Gumtree.
	6.	For each directory:
	•	Reads and parses meta.gummie.json (plus any images and a description file) into a GumtreeListing.
	•	Invokes the relevant command (e.g., post_ad(listing)).
	•	If post, it:
	1.	Clears any draft.
	2.	Fills in the ad form (title, category, description, etc.).
	3.	Uploads images.
	4.	Submits the final ad.
	•	If delete, it:
	1.	Finds the ad’s ID by matching the ad’s title from “My Ads” page.
	2.	Sends a request to delete it.
	•	Etc.
	•	Logs the outcome (true/false).
	7.	Finishes, returning you to the command line.

Hence, each piece—GummieSession, GummieBot, GumtreeListing, Form Parsers, etc.—fits into the pipeline that starts at the command line, logs into Gumtree, manipulates ads (post/delete/refresh/repost), and provides user feedback.