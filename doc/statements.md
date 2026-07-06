# Statements

This chapter covers the statements that decide *what runs next*. These are blocks
and the bindings they hold, branching with `if`, the three kinds of `for` loop,
scheduled cleanup with `defer`, and `return`.

> [!RATIONALE]
> Some languages make certain statements into expressions, so an `if` or a block can produce a value. Biron keeps statements and expressions separate. A statement is run for its effect on control flow and produces no value, and a value is produced only by an expression. The one conditional that needs to produce a value is written with the ternary `c ? a : b`, so nothing is lost by the separation while the grammar stays simple and unambiguous.

## Blocks and Scope

A block is a run of statements between braces. Every block introduces a new
lexical scope. Names bound inside it are visible only until the closing brace,
and inner scopes may refer to names from the scopes that enclose them.

```biron
fn main() -> Sint32 {
	let outer = 1;
	{
		let inner = outer + 1;   // sees `outer`
	}
	// `inner` is gone here
	return 0;
}
```

Names resolve lexically outward through the enclosing blocks, so a function may
freely read the locals of any block it is nested in.

## let Bindings

A `let` statement binds a name to a value in the current scope. *Either* a type
annotation, an initializer, or both must be supplied. A bare `let x;` with
neither is an error, because there is nothing to fix the type.

```biron
let sum = 0;            // type inferred from the initializer
let x: Sint32 = 5;      // type and value
let acc: Sint32;        // type only, assigned later
```

Redefining a name already bound in the *same* scope is an error. Shadowing is
allowed only when the new binding lives in an inner scope (an `if` rung, a loop
body, or a nested block).

## if and else

An `if` takes a condition and a block, optionally followed by `else` (another
block) or an `else if` rung. The condition must be a `Bool` (a sized boolean
converts to `Bool` here), an optional (which is tested for presence), or an `is`
type test.

```biron
if got == want {
	return 0;
}

if n < 0 {
	sign = -1;
} else if n > 0 {
	sign = 1;
} else {
	sign = 0;
}
```

> [!WARNING]
> In an `if` condition a leading `{` cannot start an aggregate literal, since
> that brace is reserved for the block that follows. A literal that is truly
> needed there must be wrapped in parentheses.

### The if let init form

An `if` may lead with a `let` init statement, written `if let x = ..; cond`.
The binding is scoped to the *whole* `if`, covering its condition, its then
branch, and its `else`. It is gone once the `if` finishes. This mirrors C++'s
`if (init; cond)`.

```biron
if let x = 10; x > 5 {
	a = x;             // `x` is visible here
} else {
	b = x;             // and here
}
```

Each rung of an `else if` chain has its *own* init, and each one shadows the
previous rung's binding. A trailing `else` therefore sees the binding of the
nearest `if` above it.

```biron
fn shadow(sel: Sint32) -> Sint32 {
	if let x = 10; x > sel {
		return x;                          // 10
	} else if let x = 20; x > sel {
		return x;                          // 20, shadows 10
	} else {
		return x;                          // 20, the second rung's binding
	}
}
```

The init also composes with optional narrowing. `if let r: ?Sint32 = 7; r`
binds `r`, then the bare-identifier condition narrows it to the contained value
inside the then branch.

## for Loops

Biron spells every loop `for`. There are three forms, and every loop condition
must be a `Bool`.

### Iterator form

`for (x) in iter` walks the elements of an iterable, binding each to `x`.

```biron
for (item) in items {
	total += item;
}
```

> [!NOTE]
> As in an `if` condition, a bare `{` in the iterable position cannot start an
> aggregate literal. It must be parenthesized if one is needed.

### C-style form

`for let i = 0; cond; post` provides an init binding, a condition, and a post
step. The init, condition, and post are all scoped to the loop. A condition that
is false on entry runs the body zero times.

```biron
let sum = 0;
for let i = 0; i < 10; i += 1 {
	sum += i;
}
// sum == 45
```

The post step may be any assignment, and loops nest naturally.

```biron
let total = 0;
for let i = 1; i <= 3; i += 1 {
	for let j = 1; j <= 3; j += 1 {
		total += i * j;
	}
}
// total == 36
```

### While form

`for cond` is a plain while loop, just a `Bool` condition and a body.

```biron
let n = 1;
let count = 0;
for n < 100 {
	n = n * 2;
	count += 1;
}
// count == 7, n == 128
```

### break and continue

Inside any loop, `break` leaves the loop immediately and `continue` skips to the
next iteration. Both affect only the innermost enclosing loop.

```biron
for let i = 0; i < 100; i += 1 {
	if i >= 5 { break; }
	if i < 2 { continue; }
	a += i;
}
```

## defer

A `defer` statement schedules its body to run when the enclosing scope exits, on
*every* path out. That covers falling off the end of the block, or a `return`
that unwinds through it. Within one scope, multiple defers run in the reverse of
their declaration order.

```biron
fn order(acc: &Sint32) {
	defer acc = acc * 10 + 1;
	defer acc = acc * 10 + 2;
	defer acc = acc * 10 + 3;
	acc = 9;               // body runs, then 3, then 2, then 1 -> 9321
}
```

An early `return` from a nested scope runs the pending defers of each enclosing
scope, innermost first, before the function actually returns. The return value
is computed before any defer runs.

```biron
fn ret(acc: &Sint32, x: Sint32) -> Sint32 {
	defer acc = acc * 10 + 1;          // function-body scope
	if x > 0 {
		defer acc = acc * 10 + 2;      // inner scope
		return 100;                    // runs 2, then 1
	}
	return 200;                        // runs 1 only
}
```

A `defer` body may not itself contain a nested `defer` or a `return`.

## return and Never-Returning Functions

`return` hands control back to the caller, optionally with a value. A function
whose return type is not unit must `return` a value on *every* control flow
path. The compiler rejects a path that falls off the end without one.

A function whose return type is `!` never returns to its caller.

```biron
fn spin() -> ! {
	for true {
	}
}
```

A function is also treated as never-returning if it calls such a function on
every path. Because a `!` function cannot fall through, it needs no `return`.

## Other statements

A few statement forms are covered in their own chapters. `with` establishes an effect for the rest of a block, described in **Effects & Hermeticity**. A statement `const` binds a compile-time constant, described in **Constants & Attributes**. An expression written on its own is an expression statement, run for its effect, most often a call or an assignment such as `x = e` or a compound assignment such as `x += e`.
