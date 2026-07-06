# Comments

Comments are text the compiler ignores. They are skipped during lexing and never change the meaning of a program, so they are free to explain intent wherever they help.

## Line comments

A line comment begins with `//` and runs to the end of the line. Anything after the `//` on that line is ignored.

```biron
let count = 0;        // retries so far
// An entire line can be a comment as well.
```

## Block comments

A block comment is delimited by `/*` and `*/` and may span several lines.

```biron
/*
   A block comment covers everything between the delimiters,
   over as many lines as needed.
*/
let ready = true;
```

Block comments **do not nest**. The first `*/` ends the comment, so a `/*` written inside a block comment is ordinary text with no special meaning.

```biron
/* a comment, and the /* inside it is just text, closed here */
```
