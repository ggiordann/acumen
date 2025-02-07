#!/usr/bin/env node

/**
 * gummiebot.js: Gumtree Australia automation software in JavaScript
 *
 * This is a port of gummiebot.py to Node.js. 
 * It aims to replicate the same structure and logic from the Python version.
 *
 * Requirements (example):
 *   npm install axios cheerio form-data prompt-sync
 *
 * Usage (similar to the Python usage):
 *   node gummiebot.js COMMAND DIRECTORY...
 *   Commands: post, delete, refresh, repost
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const promptSync = require('prompt-sync')({ sigint: true });
const process = require('process');
const difflib = require('difflib'); // for close matches
// Install with: npm install difflib

// Helper logging function (prints to stderr, as in the original Python).
function log(message, end = '\n') {
  process.stderr.write(String(message) + String(end));
}

// A small sleep/wait function to mimic random wait times used by the Python code.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// We’ll add a decorator-like function for random waiting (similar to @wait in Python).
// Because JavaScript doesn't have decorators in the same way by default, 
// we'll do it manually inside GummieSession.
async function randomDelay() {
  const MIN_WAIT = 1000;
  const MAX_WAIT = 3000;
  const ms = Math.floor(Math.random() * (MAX_WAIT - MIN_WAIT + 1)) + MIN_WAIT;
  await sleep(ms);
}

/**
 * GummieSession:
 * Mimics a requests.Session in Python.
 * Maintains cookies (through axios), and inserts random delays before requests.
 */
class GummieSession {
  constructor() {
    this._axios = axios.create({
      // You may need to configure baseURL or defaults here
      withCredentials: true
    });
  }

  async get(name, url, config = {}) {
    log(`Getting ${name}...`);
    await randomDelay();
    const response = await this._axios.get(url, config);
    // Raises on HTTP error
    return response;
  }

  async post(name, url, data = {}, config = {}) {
    log(`Posting ${name}...`);
    await randomDelay();
    const response = await this._axios.post(url, data, config);
    return response;
  }
}

/**
 * GummieBot:
 * The main class that interacts with Gumtree. 
 *   - Manages login
 *   - Tracks user ads
 *   - Tracks category map
 *   - Posts & deletes ads
 */
class GummieBot {
  static BASE_URL = 'https://www.gumtree.com.au/';

  constructor(username, password) {
    this.session = new GummieSession();
    // We'll store ads & category map in local fields, but replicate Python's lazy loading.
    this._ads = null;
    this._category_map = null;
    this.username = username;
    this.password = password;
  }

  // Getter/Setter for category_map
  get category_map() {
    return this._category_map;
  }
  set category_map(_value) {
    // Doing what Python does: setting it to null to "reset" the cache
    this._category_map = null;
  }

  // Getter/Setter for ads
  get ads() {
    return this._ads;
  }
  set ads(_value) {
    this._ads = null;
  }

  // Initialize: do the actual login
  async login() {
    const LOGIN_PAGE = 't-login.html';
    const ERROR_STRING = 'notification--error';
    const LOGIN_FORM_ID = 'login-form';
    const HTML_NAME_USERNAME = 'loginMail';
    const HTML_NAME_PASSWORD = 'password';

    // 1) Get login page to retrieve any CSRF tokens / hidden fields
    const loginUrl = GummieBot.BASE_URL + LOGIN_PAGE;
    const getResp = await this.session.get('login form', loginUrl);

    // 2) Parse hidden inputs from the form
    const formParser = new GumtreeFormParser(LOGIN_FORM_ID);
    formParser.feed(getResp.data);
    const inputs = formParser.close();

    // 3) Build form data for login
    // Python code included additional hidden fields.
    let postData = {};
    for (let inp of inputs) {
      if (inp.name === HTML_NAME_USERNAME) {
        postData[inp.name] = this.username;
      } else if (inp.name === HTML_NAME_PASSWORD) {
        postData[inp.name] = this.password;
      } else {
        // If it was hidden or checkbox, copy from the input
        if (inp.type === 'hidden') {
          postData[inp.name] = inp.value;
        } else if (inp.type === 'checkbox') {
          postData[inp.name] = 'true';
        }
      }
    }

    // 4) Submit the login form
    const postResp = await this.session.post('login details', loginUrl, new URLSearchParams(postData).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (postResp.data.includes(ERROR_STRING)) {
      throw new Error('Incorrect credentials provided');
    }

    log('Logged in');
  }

  /**
   * Delete an ad by ID.
   */
  async delete_ad_by_id(adId) {
    const SUCCESS_STRING = 'notification--success';
    const AD_ID_KEY = 'adId';
    const DELETE_PAGE = 'm-delete-ad.html';

    // This is how the original Python code did it
    const data = {
      show: 'ALL',
      reason: 'NO_REASON',
      autoresponse: 0
    };
    data[AD_ID_KEY] = String(adId);

    const deleteUrl = GummieBot.BASE_URL + DELETE_PAGE;
    const response = await this.session.get(`delete request for ad with id '${adId}'`, deleteUrl, { params: data });
    return response.data.includes(SUCCESS_STRING);
  }

  /**
   * Delete an ad by its name/title.
   */
  async delete_ad_by_name(name) {
    // We need the lazy loaded ads first
    const theAds = await this.getAds(); // triggers lazy load if needed
    // We figure out the ad ID by the exact ad title
    const adId = dict_key_else_log_similar(theAds, name, 'ad titled');
    return this.delete_ad_by_id(adId);
  }

  /**
   * Post an ad to Gumtree. 
   *   - Follows the multi-step form logic from the Python code
   */
  async post_ad(ad) {
    const SUCCESS_STRING = 'notification--success';

    // Endpoints used
    const DELETE_DRAFT_PAGE = 'p-post-ad.html';
    const FORM_PAGE = 'p-post-ad2.html';
    const FORM_ID = 'pstad-main-form';
    const UPLOAD_IMAGE_TARGET = 'p-upload-image.html';
    const DESIRED_IMAGE_URL_KEY = 'teaserUrl';
    const DRAFT_TARGET = 'p-post-draft-ad.html';
    const SUBMIT_TARGET = 'p-submit-ad.html';

    // 1) Delete any existing draft
    const deleteDraftUrl = GummieBot.BASE_URL + DELETE_DRAFT_PAGE;
    await this.session.get('delete request for drafts', deleteDraftUrl, {
      params: { delDraft: 'true' }
    });

    // 2) Go to the "main" form
    //    This is the "p-post-ad2.html" endpoint, POSTing with 
    //    { title, categoryId, adType, shouldShowSimplifiedSyi=false }
    const formData = new URLSearchParams();
    formData.set('title', ad.title);
    formData.set('categoryId', await this.category_name_to_id(ad.category));
    formData.set('adType', 'OFFER');
    formData.set('shouldShowSimplifiedSyi', 'false');

    const formUrl = GummieBot.BASE_URL + FORM_PAGE;
    const formResp = await this.session.post('ad post form', formUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // 3) Parse the main form for hidden inputs
    const formParser = new GumtreeFormParser(FORM_ID);
    formParser.feed(formResp.data);
    const inputs = formParser.close();

    // We'll track the name for condition field
    let conditionFieldName = false;

    // 4) Build the next submission data
    //    (We replicate the Python approach: fill known fields, copy others)
    let submission = {
      'description': ad.description,
      'price.amount': ad.price.amount,
      'price.type': ad.price.type
    };

    for (let inp of inputs) {
      if (!inp.name) continue;

      if (!(inp.name in submission)) {
        // Not overriding what we already have
        if (inp.type === 'checkbox') {
          // The Python code sets it to 'true' by default
          // or it might remain empty—this depends on your real usage
          submission[inp.name] = 'true';
        } else {
          submission[inp.name] = inp.value || '';
          if (inp.name.includes('condition')) {
            conditionFieldName = inp.name;
          }
        }
      }
    }

    if (!conditionFieldName) {
      throw new Error('Could not extract field name for item condition using known method');
    }
    submission[conditionFieldName] = ad.condition;

    // 5) Upload images one-by-one
    log('Uploading images...');
    let imageLinks = [];
    for (let imagePath of ad.images) {
      const uploadUrl = GummieBot.BASE_URL + UPLOAD_IMAGE_TARGET;
      const form = new FormData();
      // The server may also need other form fields from submission, but the Python code
      // only passes 'images' in "files=...". We'll attempt similarly in JS.
      form.append('images', fs.createReadStream(path.resolve(imagePath)));

      // The Python code also tries to pass the entire submission as data,
      // but that can differ. If needed, you might do:
      // Object.keys(submission).forEach(key => form.append(key, submission[key]));

      const resp = await this.session.post(`image '${imagePath}'`, uploadUrl, form, {
        headers: form.getHeaders()
      });
      try {
        const data = resp.data;
        // The Python code tries: `url = response.json()["teaserUrl"]`
        // In JS/axios, data is already JSON if the server returns JSON 
        // (unless we must parse it).
        const url = data[DESIRED_IMAGE_URL_KEY];
        if (!url) throw new Error("No teaserUrl found");
        imageLinks.push(url);
      } catch (e) {
        throw new Error(`Could not extract uploaded image URL for image '${imagePath}'`);
      }
    }
    submission['images'] = imageLinks;

    // 6) Post a draft (optional step from Python code)
    const draftUrl = GummieBot.BASE_URL + DRAFT_TARGET;
    await this.session.post('draft', draftUrl, new URLSearchParams(submission).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // 7) Final submission
    const submitUrl = GummieBot.BASE_URL + SUBMIT_TARGET;
    const finalResp = await this.session.post('final listing', submitUrl, new URLSearchParams(submission).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return finalResp.data.includes(SUCCESS_STRING);
  }

  /**
   * Lazy-load the category_map. 
   * The original code scrapes the homepage for a JS snippet
   *   Gtau.Global.variables.categories = {...};
   */
  async getCategoryMap() {
    if (this._category_map) {
      return this._category_map;
    }
    // This is the code that scrapes from the homepage (or categories page).
    const CATEGORIES_PAGE = ''; // just use the home page
    const CATEGORIES_REGEX = /Gtau\.Global\.variables\.categories\s+=\s+({.*?})\s*;/;

    const url = GummieBot.BASE_URL + CATEGORIES_PAGE;
    const response = await this.session.get('categories', url);
    const html = response.data;
    const match = CATEGORIES_REGEX.exec(html);
    if (!match) {
      throw new Error('Could not extract Gumtree ad categories using known method');
    }
    const fullTree = JSON.parse(match[1]);

    // Build a map { "categoryName": "categoryID", ... }
    let catMap = {};
    gummie_category_extract(fullTree, catMap);

    this._category_map = catMap;
    return this._category_map;
  }

  // Helper to get category ID from category name, with "did you mean" support
  async category_name_to_id(categoryName) {
    const catMap = await this.getCategoryMap();
    return dict_key_else_log_similar(catMap, categoryName, 'category');
  }

  /**
   * Lazy-load the user's ads (title -> ad ID).
   */
  async getAds() {
    if (this._ads) {
      return this._ads;
    }
    const ADS_PAGE = 'm-my-ads.html';
    const url = GummieBot.BASE_URL + ADS_PAGE;
    const response = await this.session.get('ads', url);

    const parser = new GumtreeMyAdsParser();
    parser.feed(response.data);
    const nameToIdMap = parser.close();

    this._ads = nameToIdMap;
    return this._ads;
  }
}

/**
 * GumtreeFormParser:
 * A minimal "form + input" parser to mirror the Python code that uses html.parser.
 * We’ll do a quick approach with Cheerio to find a <form id="..."> and read <input> tags inside.
 */
class GumtreeFormParser {
  constructor(targetId) {
    this.targetId = targetId;
    this.inputs = [];
    this.insideDesiredForm = false;
  }

  feed(html) {
    const $ = cheerio.load(html);
    const form = $(`form#${this.targetId}`);
    if (!form || form.length === 0) {
      return;
    }
    const inputElems = form.find('input');
    inputElems.each((i, el) => {
      const attribs = el.attribs || {};
      this.inputs.push({
        name: attribs.name,
        type: attribs.type,
        value: attribs.value || ''
      });
    });
  }

  close() {
    return this.inputs;
  }
}

/**
 * GumtreeMyAdsParser:
 * Scrapes the "My Ads" page for each ad’s title and ID.
 * The Python uses an <a class="rs-ad-title" href="... adId=XXXX">Title</a>.
 */
class GumtreeMyAdsParser {
  constructor() {
    this.ads = {}; // Will store { adId: adTitle } temporarily
  }

  feed(html) {
    const $ = cheerio.load(html);
    const links = $('a.rs-ad-title');
    links.each((i, el) => {
      const href = $(el).attr('href') || '';
      const match = /adId=(\d+)/.exec(href);
      if (match) {
        const adId = match[1];
        const title = $(el).text().trim();
        this.ads[adId] = title;
      }
    });
  }

  close() {
    // The Python code returns a dict mapping title -> adId.
    // Here we invert { adId: title } into { title: adId }.
    let nameToIdMap = {};
    for (let [id, title] of Object.entries(this.ads)) {
      nameToIdMap[title] = id;
    }
    return nameToIdMap;
  }
}

/**
 * GumtreeListing data class, just like the Python version.
 */
class GumtreeListing {
  static KNOWN_PRICE_TYPES = ['FIXED', 'NEGOTIABLE', 'GIVE_AWAY', 'SWAP_TRADE'];
  static KNOWN_CONDITIONS = ['used', 'new'];

  constructor(title, description, price, category, condition, images) {
    this.title = title;
    this.description = description;

    if (typeof price !== 'object' || price === null) {
      throw new Error("Expected 'price' to be an object/dictionary");
    }
    if (!('amount' in price) || !('type' in price)) {
      throw new Error("Expected subkeys 'amount' and 'type' in 'price'");
    }

    // Validate the price amount
    const floatVal = parseFloat(price.amount);
    if (isNaN(floatVal)) {
      throw new Error("'amount' is not a valid decimal number");
    }
    if (floatVal <= 0) {
      throw new Error("'amount' must be greater than zero");
    }
    if (!GumtreeListing.KNOWN_PRICE_TYPES.includes(price.type)) {
      throw new Error(`Price type '${price.type}' unknown`);
    }
    this.price = {
      amount: floatVal,
      type: price.type
    };

    this.category = category;
    if (!GumtreeListing.KNOWN_CONDITIONS.includes(condition)) {
      throw new Error(`Condition '${condition}' unknown`);
    }
    this.condition = condition;
    this.images = images;
  }

  debug() {
    return {
      title: this.title,
      description: this.description,
      price: this.price,
      category: this.category,
      condition: this.condition,
      images: this.images
    };
  }
}

/**
 * gummie_json_parse(directory): 
 *   - Reads meta.gummie.json
 *   - Loads data
 *   - Returns a GumtreeListing
 */
function gummie_json_parse(directory) {
  const GUMMIE_JSON_FILENAME = 'meta.gummie.json';
  const DEFAULT_CONDITION = 'used';

  // Switch to the directory (the Python code does os.chdir, 
  // but we can just read relative to that directory).
  const metaPath = path.join(directory, GUMMIE_JSON_FILENAME);
  log(`Opening '${metaPath}'...`);
  const rawData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  let listingData = {};
  listingData.title = rawData['title'];

  // Load description from the file path in description_file
  const descFilePath = path.join(directory, rawData['description_file']);
  listingData.description = fs.readFileSync(descFilePath, 'utf-8');

  listingData.price = rawData['price'];
  listingData.category = rawData['category'];
  listingData.condition = rawData['condition'] || DEFAULT_CONDITION;

  // Validate images exist
  listingData.images = [];
  if (!Array.isArray(rawData['images'])) {
    throw new Error("'images' must be an array");
  }
  rawData['images'].forEach(imgName => {
    const imgPath = path.join(directory, imgName);
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Could not find image '${imgPath}'`);
    }
    listingData.images.push(imgPath);
  });

  return new GumtreeListing(
    listingData.title,
    listingData.description,
    listingData.price,
    listingData.category,
    listingData.condition,
    listingData.images
  );
}

/**
 * gummie_category_extract(tree, category_map):
 *   Recursively extracts only the "leaf" categories (with no children).
 */
function gummie_category_extract(tree, category_map) {
  if (Array.isArray(tree.children) && tree.children.length > 0) {
    // Recur
    for (let child of tree.children) {
      gummie_category_extract(child, category_map);
    }
  } else {
    // Leaf node
    category_map[tree.name] = tree.id;
  }
}

/**
 * dict_key_else_log_similar(dict_, key, log_noun='key'):
 *   If dict_[key] doesn’t exist, suggest something close.
 */
function dict_key_else_log_similar(obj, key, logNoun = 'key') {
  if (key in obj) {
    return obj[key];
  } else {
    // Suggest close matches
    const keys = Object.keys(obj);
    const matches = difflib.getCloseMatches(key, keys, 1);
    if (matches.length > 0) {
      throw new Error(`Unknown given ${logNoun} '${key}'. Did you mean '${matches[0]}'?`);
    } else {
      throw new Error(`Unknown given ${logNoun} '${key}'`);
    }
  }
}

// MAIN entry point:
async function main() {
  const argv = process.argv;
  if (argv.length < 4) {
    log('usage: gummiebot.js COMMAND DIRECTORY...');
    log('       Automation script for Gumtree Australia');
    log('       Execute COMMAND on one or more DIRECTORY sequentially');
    log('');
    log('COMMANDS');
    log('    post        Uploads ad');
    log('    delete      Deletes ad by name');
    log('    refresh     Finds and deletes ad, and then posts it, failing if ad did not exist previously');
    log('    repost      Finds and deletes ad if it exists, then posts ad');
    process.exit(0);
  }

  const command = argv[2];
  // Define the command->function mapping
  const str2func = {
    post: async (gb, listing) => gb.post_ad(listing),
    delete: async (gb, listing) => gb.delete_ad_by_name(listing.title),
    refresh: async (gb, listing) => {
      // Must exist; if not found, fail
      const delOk = await gb.delete_ad_by_name(listing.title);
      if (!delOk) return false;
      return gb.post_ad(listing);
    },
    repost: async (gb, listing) => {
      // Try to delete, ignoring errors
      try {
        await gb.delete_ad_by_name(listing.title);
      } catch (err) {
        log(`Attempt at deleting resulted in a warning:\n    ${err}`);
      }
      return gb.post_ad(listing);
    }
  };

  if (!(command in str2func)) {
    throw new Error(`Unknown command '${command}'`);
  }

  // Prompt for username & password
  log('Username: ', '');
  const username = promptSync('');
  const password = promptSync('Password: ', { echo: '*' });

  // Create the GummieBot instance, do the login
  const gb = new GummieBot(username, password);
  await gb.login();

  // Process each directory
  //   e.g. node gummiebot.js post someDir anotherDir ...
  const directories = argv.slice(3);
  const originalWorkingDir = process.cwd();

  for (let dir of directories) {
    // In Python code, we do os.chdir(...) but let's just pass the absolute path.
    const absoluteDir = path.isAbsolute(dir) ? dir : path.join(originalWorkingDir, dir);
    log(`Processing directory: ${absoluteDir}`);
    const listing = gummie_json_parse(absoluteDir);

    // Execute the chosen command function
    const result = await str2func[command](gb, listing);
    log(`Result for listing '${listing.title}': ${result}`);
  }
}

// If run directly from the command line, execute main():
if (require.main === module) {
  main().catch(err => {
    log(`Error: ${err}`);
    process.exit(1);
  });
}