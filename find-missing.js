import Mbox from "node-mbox";
import flattenDeep from "lodash.flattendeep";

import fs from "fs";
import crypto from "crypto";

function createReadStreamFromArgument(argument) {
	if (argument === "-") {
		return process.stdin;
	} else {
		return fs.createReadStream(argument);
	}
}

function hash(string) {
	const hash = crypto.createHash("md5");
	return hash.update(string).digest("hex");
}

const headerBodySplitter = /\n\r*\n/;
function getHeaderAndBody(email) {
	const bodyStart = email.search(headerBodySplitter);

	return { headers: email.slice(0, bodyStart), body: email.slice(bodyStart) };
}

function getMboxHashes(argument) {
	let mbox = new Mbox();

	let hashes = [];

	mbox.on("message", function(email) {
		hashes.push(hash(getHeaderAndBody(email).body));
	});

	let result = new Promise(function (resolve) {
		mbox.on("end", () => {
			resolve(hashes);
		});
	});

	createReadStreamFromArgument(argument).pipe(mbox);

	return result;
}

function processPartEmails(argument, wholeHashes) {
	let mbox = new Mbox();

	mbox.on("message", email => {
		let { headers, body } = getHeaderAndBody(email);
		const bodyHash = hash(body);
		if (!wholeHashes.some(wholeHash => bodyHash === wholeHash)) {
			process.stdout.write(headers, "binary");

			if (argument !== "-" && headers.indexOf("\nX-Was-Archived-At:") === -1) {
				process.stdout.write("\nX-Was-Archived-At: " + argument, "binary");
			}

			process.stdout.write(body, "binary");
			process.stdout.write("\n", "binary");
		}
	});

	createReadStreamFromArgument(argument).pipe(mbox);
}

function usage() {
	process.stderr.write("Improper usage.\n");
	process.stderr.write(`Usage: find-missing.js [<mbox>|-]... --in [<mbox>|-]...\n`);
	process.exit(1);
}

const splitOnArg = "--in";
let argv = process.argv.slice(2);

if (argv.indexOf(splitOnArg) === -1) usage();

let parts = argv.slice(0, argv.indexOf(splitOnArg));
let wholes = argv.slice(argv.indexOf(splitOnArg) + 1);

if (parts.length === 0 || wholes.length === 0) usage();

async function start() {
	let wholeHashes = await * wholes.map(getMboxHashes);
	wholeHashes = flattenDeep(wholeHashes);

	for (let part of (parts: Array)) {
		processPartEmails(part, wholeHashes);
	}
}

start();
