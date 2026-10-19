# ndjsonq

`ndjsonq` is a dependency-free Node.js command-line tool for filtering,
projecting, and formatting newline-delimited JSON (NDJSON) records. It streams
input line by line, so it can handle large files without loading them entirely
into memory.

## Features

- Filter records with a small expression language.
- Select a subset of fields from each record.
- Skip and limit matching records.
- Count matching records.
- Output as JSON Lines, compact JSON, or pretty-printed JSON.
- Read from a file or standard input.

## Requirements

- Node.js 18 or newer.

## Installation

```sh
npm install -g .
```

Or run directly from the repository:

```sh
node bin/ndjsonq.js --help
```

## Usage

```sh
# Keep active users who are at least 18 years old
ndjsonq data.ndjson 'age >= 18 && status == "active"'

# Select only a few fields
ndjsonq --select id,name,status data.ndjson

# Count matching records
ndjsonq --count data.ndjson 'role == "admin"'

# Pretty-print the first ten matching records
ndjsonq --format pretty --limit 10 data.ndjson 'score > 90'

# Read from standard input
 cat data.ndjson | ndjsonq 'user.role == "admin"'
```

## Expression language

Paths use dot notation and bracket indexing:

```text
user.name
items[0].name
```

Supported operators:

```text
== != < <= > >= && || ! + - * / %
```

Membership tests use `in`:

```text
"admin" in roles
name in user
text in body
```

Literals include numbers, strings, booleans, `null`, and arrays:

```text
42
"hello"
true
false
null
[1, 2, 3]
```

Available functions:

```text
length, lower, upper, trim, exists, type, number, string,
abs, min, max, keys, contains, includes
```

## Examples

```sh
ndjsonq events.ndjson 'type == "login" && user.active'
ndjsonq events.ndjson 'contains(tags, "urgent")'
ndjsonq events.ndjson --select user.id,user.name 'user.age >= 21'
```

## Development

```sh
npm test
```

## License

MIT
