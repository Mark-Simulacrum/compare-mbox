#!/usr/bin/env babel-node

import fs from "fs";
import readline from "readline";
import crypto from "crypto";

function createReadStreamFromArgument(argument) {
	let stream;
	if (argument === "-") {
		stream = process.stdin;
	} else {
		stream = fs.createReadStream(argument);
	}

	stream.setEncoding("binary");

	return stream;
}

function hash(string) {
	const hash = crypto.createHash("md5");
	return hash.update(string).digest("hex");
}

function processMbox(mboxPath, callback) {
	const readStream = createReadStreamFromArgument(mboxPath);

	const reader = readline.createInterface({
		input: readStream,
		terminal: false,
		historySize: 1
	});

	readStream.on("end", () => reader.close());

	let fromLine = "";
	let sawBlankline = true;
	let inProgressHeaders = "";
	let inProgressBody = "";
	let isReadingHeaders = true;
	reader.on("line", line => {
		if (line.indexOf("From ") === 0 && sawBlankline) {
			// Process previous email
			callback(mboxPath, fromLine, inProgressHeaders, inProgressBody);

			// Setup processing for this email
			isReadingHeaders = true;
			inProgressHeaders = "";
			inProgressBody = "";

			fromLine = line;
		} else if (isReadingHeaders) {
			if (line.length === 0) {
				isReadingHeaders = false;
			} else {
				inProgressHeaders += line + "\n";
			}
		} else {
			inProgressBody += line + "\n";
		}

		sawBlankline = line.length === 0;
	});
}

let wholeHashes = [];
function addToWholeHashes(mboxPath, fromLine, headers, body) {
	wholeHashes.push(hash(body));
}

function isMissing(mboxPath, fromLine, headers, body) {
	const bodyHash = hash(body);

	if (!wholeHashes.some(hash => hash === bodyHash)) {
		process.stdout.write(fromLine + "\n", "binary");
		process.stdout.write(headers, "binary");
		// if (mboxPath !== "-" && headers.indexOf("\nX-Was-Archived-At:") === -1) {
		// 	process.stdout.write("X-Was-Archived-At: " + mboxPath + "\n", "binary");
		// }
		process.stdout.write("\n", "binary");
		process.stdout.write(body, "binary");
	}
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

for (let wholeMbox of wholes) {
	processMbox(wholeMbox, addToWholeHashes);
}

for (let partMbox of parts) {
	processMbox(partMbox, isMissing);
}
