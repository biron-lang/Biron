# Constants & Attributes

This chapter covers two features that act on a program before it ever runs. They
are `const` bindings, which name values the compiler folds at compile time, and
attributes, the `@(...)` annotations that tune a declaration's layout, inlining,
and linkage.

## Constants

A `const` binds a name to a constant expression. It may appear at file scope or
as a statement inside a function. Unlike a `let`, a `const` is always immutable
and always requires an initializer.

```biron
const MAX = 100;
const LIMIT = MAX + 20;
const N: Uint32 = 4;
const GREETING = "hello consts";
```

The type annotation is optional. When omitted the value's own type is used, and
untyped numeric literals settle on a default. The annotation is written when a
specific type is needed, as with `N` above.

A constant plays two roles at once. It is a *constant expression*, so it can be
used wherever the compiler needs a compile-time value, as an array size, an enum
member value, a generic argument, or the initializer of another `const`. It is
also *read-only storage with a stable address*, so taking its address with `&` is
valid, and the address of a `const` or of a function is itself a constant.

```biron
const N: Uint32 = 4;

fn use_size() -> Sint32 {
	let b: [N]Sint32;   // a const as an array size
	b[0] = 1;
	b[3] = 9;
	return b[0] + b[3];
}

const NUMS = [4]Sint32 { 10, 20, 30, 40 };
const NUM2: *Sint32 = &NUMS[2];   // address of a const element is constant

fn add(a: Sint32, b: Sint32) -> Sint32 { return a + b; }
const ADDER = add;                // a function value is constant
```

Constants follow the same scope chain as `let`. A `const` declared inside a block
does not escape it. Unlike `let`, though, constants resolve in **any order**, so a
constant may refer to one declared later in the file.

```biron
const FWD   = LATER + 1;   // fine even though LATER comes after
const LATER = 40;
```

A `const` written as a statement cannot be assigned to afterward. It is a name for
one fixed value.

### What a constant can hold

A `const` can hold any value the folder can build, not just scalars. It can hold
strings, aggregates (structs, tuples, and arrays), unions, optionals, and enum
values.

```biron
type Point = struct { x: Sint32, y: Sint32 }
const ORIGIN = Point { .x = 3, .y = 4 };

type Color = enum { Red, Green = 5, Blue }
const FAV:  Color  = Color.Green;
const FAV2: Color  = .Blue;        // implicit enum selector

const MAYBE: ?Sint32 = 42;
const NOPE:  ?Sint32 = {};         // the none / zero value

type Value = union { Sint32, Bool }
const BOXED = Value { 7 };
```

### Constant evaluation

The folder evaluates integer and float literals, named constants, and arithmetic
over them, so an expression like `(2 * 10) / 5` folds to a single value. An array
size must fold to a non-negative constant.

```biron
fn local() -> Sint32 {
	const K   = 7;
	const DBL = K * 2;     // folds to 14
	return DBL;
}
```

## Attributes

An attribute is written `@(name(args))` and placed immediately before a
declaration or a statement. Several may be combined in one set, separated by
commas, as in `@(a, b)`. The sections below cover the attributes used
directly.

### Inlining — `@(inline)`

`@(inline(mode))` on a function is an inlining hint, where `mode` is one of
`"always"`, `"never"`, or `"hint"`. Plain `@(inline)` means `@(inline("hint"))`.
It never changes what the function does.

```biron
@(inline("always"))
fn add(a: Sint32, b: Sint32) -> Sint32 { return a + b; }

@(inline)
fn twice(a: Sint32) -> Sint32 { return add(a, a); }

@(inline("never"))
fn dec(a: Sint32) -> Sint32 { return a - 1; }
```

### Packed layout — `@(packed)`

`@(packed)` on a struct type removes all inter-field padding, laying the fields
out with byte alignment and no gaps. Because a field may then be misaligned, its
address cannot be taken. Writing `&s.field`, or binding it to a `&T`, is an error. Only
whole-value reads and assignments are allowed, and `&s` on the whole object is
still fine.

```biron
@(packed)
type Packed = struct { a: Uint8, b: Uint32, c: Uint8 }

fn use() {
	let p: Packed;
	p.a = 1 as Uint8;
	p.b = 1000;        // read and assign the whole field, never &p.b
	p.c = 2 as Uint8;
}
```

### Alignment — `@(aligned(N))`

`@(aligned(N))` raises the alignment of a type or a single binding to `N`, which
must be a constant power of two. Alignment can only be raised, never lowered below
the natural alignment. On a struct or union type it sets that type's alignment. On
a variable it over-aligns just that binding's storage.

```biron
@(aligned(16))
type Over = struct { x: Uint32, y: Uint32 }

fn use() {
	@(aligned(64)) let scalar: Sint32 = 99;
	@(aligned(32)) let arr: [8]Sint32;
	arr[3] = 5;
}
```

### Field reordering — `@(reorder(bool))`

`@(reorder(bool))` controls whether an aggregate's fields are physically sorted
into descending size order to cut padding. The reordering is purely physical. The
declared index is unchanged, so `t.0` and `s.field` still name the same element.

- **Tuples reorder by default.** `@(reorder(false))` keeps the declared order.
- **Structs keep their declared layout by default.** `@(reorder(true))` opts in.

```biron
@(reorder(false))
type Flat = (Uint8, Uint64, Uint8)     // keep declared order

@(reorder(true))
type Packed = struct { a: Uint8, b: Uint64, c: Uint8 }   // opt in

fn use() {
	// A binding-level reorder on an inline tuple type.
	@(reorder(false)) let v: (Uint8, Uint64) = (7 as Uint8, 8 as Uint64);
}
```

> [!NOTE]
> Two aggregates that differ only in reordering are the same type to the checker.
> Passing one where the other is expected re-lays the value out automatically.

### Other attributes

A few attributes belong to features covered elsewhere.

| Attribute | Purpose | See |
|-----------|---------|-----|
| `@(swizzle("xyzw"))` | name an array's components for swizzle access | Aggregates |
| `@(unsafe_div)` | skip the checked-division zero test in its scope | Expressions |
| `@(link(when, lib))` | bind a foreign library | Modules |

```biron
@(swizzle("xyzw"))
type Vec4 = [4]Sint32

@(unsafe_div)
fn fastdiv(a: Sint32, b: Sint32) -> Sint32 { return a / b; }
```
