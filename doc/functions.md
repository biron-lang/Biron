# Functions & Methods

Functions are Biron's basic unit of code. A function pairs a signature with a
body, and the same signature, written without a name or body, doubles as a
first-class function type. On top of plain functions Biron layers three
call forms that share one resolution rule, methods called as `value.name(args)`,
multi-value receivers spread from a tuple, and associated functions called as
`Type::name(args)`.

## Declaring a function

A function is written `fn name(params) -> Ret { ... }`. Each parameter is
`name: Type`, and the return type follows `->`. A value-returning function must
return on every path.

```biron
fn add(a: Sint32, b: Sint32) -> Sint32 { return a + b; }
```

When the `->` is omitted, the function returns unit (it produces no value, the
equivalent of a `void` function elsewhere).

```biron
fn setit(x: Sint32, y: &Sint32) { y = x; }
```

Top-level declarations are order-independent. Names are collected before bodies
are checked, so a function may freely call another declared later in the file,
with no forward declarations.

> [!NOTE]
> Generic parameters (`fn[T: Type] ...`) and effect lists (`fn ... <E> -> R`)
> are part of the signature too. They get their own chapters. Everything below
> composes with them.

### Anonymous parameters

A parameter may be written as a bare type with no name. It still takes a
positional argument, callers must still pass it, but the body cannot refer to
it. This is handy for signatures where a slot exists only to match an expected signature.

```biron
fn const7(Sint32) -> Sint32 { return 7; }        // fully anonymous
fn pick(a: Sint32, Sint32, c: Sint32) -> Sint32 { return a + c; }
```

Anonymous parameters are allowed anywhere a `()` parameter list appears,
function declarations, receivers, foreign prototypes, and function types.
Generic parameter lists (`[]`) and struct field lists (`{}`) still
require names.

## Function values

A function name used in value position is a function value of type
`fn(params) -> R`. It can be stored in a variable, passed as an argument, and
called either directly or through the value. The function type may be annotated
explicitly or left to be inferred.

```biron
let f: fn(a: Sint32, b: Sint32) -> Sint32 = add;   // annotated
let g = inc;                                        // inferred
f(3, 4);                                            // called through the pointer
```

Because a function value is just a typed pointer, a function that takes one as a
parameter can call through it.

```biron
fn apply(g: fn(x: Sint32) -> Sint32, x: Sint32) -> Sint32 {
	return g(x);
}
```

A call `e(args)` accepts any expression of function type, not only a name. A
call of a known function is a direct call. A call through a variable, field, or
narrowed optional dispatches through the value. A function value is never
null, so like any pointer it must be initialized. When an absent value is needed,
an optional `?fn(...) -> R` is used, which is `none` until narrowed.

## Methods

A function written with a *receiver*, a parameter group before the name, is a
method. `fn(recv: T) name(args)` is called as `value.name(args)`.

```biron
type P = struct { x: Sint32, y: Sint32 }

fn(p: P) sum() -> Sint32 { return p.x + p.y; }

let pt = P { .x = 3, .y = 4 };
pt.sum();                                           // 7
```

Method resolution is global and exact. A call matches any function whose
receiver type equals the receiver value after peeling at most one reference
layer, with an exact match preferred over a reference-peeled one. There are no
implicit numeric conversions in receiver matching.

The receiver may be a value, a reference, or a pointer, and the choice controls
aliasing.

| Receiver | Binds | Effect |
|----------|-------|--------|
| `T`  | a copy of the value | reads are safe, writes are local |
| `&T` | a reference to the caller | writes mutate the caller's value |
| `*T` | a pointer | caller passes `&value` |

```biron
fn(p: &P) scaled(k: Sint32) -> Sint32 { return (p.x + p.y) * k; }
fn(p: *P) first() -> Sint32 { return (*p).x; }
fn(n: Sint32) twice() -> Sint32 { return n + n; }

pt.scaled(10);        // binds &pt
(&pt).first();        // *P receiver, supplied by &pt
(5).twice();          // a scalar rvalue receiver
```

## Multiple receivers

A receiver group may bind several values. At the call site a *literal* tuple
supplies them. `(a, b).name()` spreads the tuple into separate receiver
arguments and binds a reference to each variable element, so a `&T` receiver
aliases the caller exactly as a single `&T` receiver does.

```biron
fn(x: &Sint32, y: &Sint32) add_into() { x = x + y; }

let m = 10;
let n = 5;
(m, n).add_into();    // m aliases the &Sint32 receiver, becomes 15
```

Element-wise matching lets the parts have different types.

```biron
fn(p: P, k: Sint32, on: Bool) blend(extra: Sint32) -> Sint32 {
	if on { return (p.x + p.y) * k + extra; }
	return extra;
}

(pt, mul, true).blend(1);    // 7*10 + 1
```

The spread is purely a call-site form. A tuple *value* held in a variable is a
single receiver and matches a single tuple-typed receiver `fn(t: (A, B)) foo()`,
not the multi-argument form.

> [!TIP]
> The explode operator `~` produces the same spread from an existing aggregate.
> `(~pair).store(40)` splices `pair`'s elements into the receiver group, and a
> `&T` element still aliases the original. `~` works the same way in ordinary
> call arguments and aggregate literals.

## Associated functions

An associated function is written `fn T::name(args)`, where `T` denotes a type. It
has no receiver and is called as `T::name(args)`, so it reads like a
constructor or factory. A receiver is rejected, since an associated function is
instance-less.

```biron
type Vec2 = struct { x: Sint32, y: Sint32 }

fn Vec2::zero() -> Vec2 { return Vec2 { .x = 0, .y = 0 }; }
fn Vec2::make(a: Sint32, b: Sint32) -> Vec2 { return Vec2 { .x = a, .y = b }; }

// One associated function may call another by the same spelling.
fn Vec2::diagonal(n: Sint32) -> Vec2 { return Vec2::make(n, n); }

let v = Vec2::make(3, 4);
let d = Vec2::diagonal(5);
```

Every other rule of a normal function applies, including generics and effects. A
generic associated function is instantiated at the call site with the turbofish.

```biron
type Box = struct { v: Sint32 }
fn[N: Uint32] Box::val() -> Sint32 { return N as Sint32; }

Box::val::[9]();    // 9
```
