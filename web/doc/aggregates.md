# Aggregates & Literals

Aggregates are the compound values of Biron, namely structs, arrays, tuples, and enums. Each has a literal form for building a value directly in source. This chapter walks through those forms, the rules that govern how their fields and elements are filled, and a few conveniences (implicit enum selectors, swizzles, and the explode operator) that make working with them concise.

## Struct literals

A struct value is written `Name { .field = value, ... }`. Initializers may be **named** (`.field = value`, in any order) or **positional** (a bare `value`).

```biron
type Point = struct { x: Sint32, y: Sint32 }

let a = Point { .x = 3, .y = 4 };   // named
let b = Point { 10, 20 };           // positional: x = 10, y = 20
```

Any field left out is zeroed, so `Point { .x = 5 }` gives a point with `y = 0`.

### The C99 cursor rule

Named and positional initializers may be mixed. A positional initializer fills the field *after* the previously set one, exactly like a C99 designated initializer. So a positional value that follows a named one continues from that named field.

```biron
type Tri = struct { a: Sint32, b: Sint32, c: Sint32 }

let t: Tri = { .b = 2, 3 };   // .b sets b, then 3 fills c (the field after b)
// t.a = 0, t.b = 2, t.c = 3
```

> [!CAUTION]
> Designating a field and then supplying a trailing positional past the last field overflows and is an error.

### Inferring the type, and the `{}` zero value

The type name may be omitted whenever the aggregate's type is fixed by context, a binding annotation, an assignment target, a call argument, a return type, or an enclosing element or field. An anonymous `{ ... }` then infers its type, and this nests.

```biron
fn sum(p: Point) -> Sint32 { return p.x + p.y; }

let p: Point = { .x = 3, .y = 4 };        // annotation
let a: [2]Point = { { 5, 0 }, { 0, 6 } }; // outer and inner both inferred
let n = sum({ 4, 5 });                    // call argument
```

The typeless `{}` is the **zero value** of whatever type the context expects. It coerces to any type.

```biron
let p: Point   = {};   // both fields 0
let n: Sint32  = {};   // 0
```

> [!IMPORTANT]
> A struct or array that transitively holds a pointer or reference cannot be left partly uninitialized, since the missing slot would be zeroed. Every such slot must be covered.

## Anonymous composite literals

An anonymous composite (`struct { ... }`, `union { ... }`, `enum { ... }`) is a structural type. It matches any type with the same structure, named or not. Written inline before the braces, it is its own literal form.

```biron
let v = struct { x: Bool } { true };
```

Because the structure is what matters, an anonymous struct value is accepted anywhere a named type with the same structure is expected.

```biron
let b: struct { x: Sint32, y: Sint32 } = { .x = 10, .y = 20 };
let s = sum(b);   // accepted where a Point is wanted
```

## Arrays

An array literal is `[N]T { ... }` for an explicit length, or `[?]T { ... }` to infer the length from the highest initialized slot. Elements are positional or designated by a numeric index `.i = value`. Both mix under the same cursor rule as struct fields.

```biron
let a = [3]Sint32 { 10, 20, 30 };        // positional
let b = [?]Sint32 { 1, 2, 3, 4 };        // length inferred as 4
let c = [2]Sint32 { .1 = 10, .0 = 20 };  // designated, any order
let d = [4]Sint32 { 7, 8 };              // rest zero-filled: d[2] = d[3] = 0
```

The cursor persists across designators, so a positional after `.2` fills slot 3.

```biron
let f = [4]Sint32 { 10, .2 = 30, 40 };
// f[0]=10, f[1]=0, f[2]=30, f[3]=40
```

For `[?]T`, the length is one past the highest slot touched, whether by a designator or by the cursor.

> [!NOTE]
> The slice type `[]T` has no literal because it has no fixed length.

### Enumerated array literals

An enumerated array `[enum; E]T` is indexed by the enumerators of an enum. Its literal designates slots by member name.

```biron
type Foo = enum { A, B, C }

let x = [enum; Foo]String { .A = "A", .C = "C", .B = "B" };
let s = x[.A];   // "A"
```

## Tuples

A tuple is written `(a, b, c)`. Elements are accessed by numeric index `t.0`, which is an lvalue that can be read or assigned.

```biron
let t = (10, 20, 30);
let first = t.0;         // 10
let sum   = t.0 + t.1 + t.2;

let m = (1, 2, 3);
m.0 = 100;               // assigning an element replaces it in place
let p = &t.0;            // the address of an element
```

## Enums

An enum declares a set of named members. The first is `0`, and each later member is the previous value plus one unless it is set with `= expr`. `enum as T` chooses the underlying integer type (the default is `Sint32`).

```biron
type Color  = enum { Red, Green, Blue }        // 0, 1, 2
type Status = enum { Ok = 0, Warn = 10, Err }  // 0, 10, 11
type Small  = enum as Uint8 { Lo = 200, Hi }   // 200, 201
```

A member is accessed with `Color.Green`, which is a value of the enum type.

```biron
let c: Color = Color.Green;
```

Enums are **strongly typed**. An enum never implicitly becomes its underlying integer and an integer never implicitly becomes an enum. Two distinct enums do not coerce to one another. The boundary is crossed explicitly with `as`.

```biron
let n = Color.Blue as Sint32;   // 2
```

### Implicit enum selectors

In a context that already fixes the enum type, just `.Member` is written and the enum name is inferred. This works at a call argument, an annotated binding, an assignment, a return, an aggregate field, a comparison peer, and a ternary branch.

```biron
type Pair = struct { a: Color, b: Status }

let c: Color = .Green;          // annotated binding
d = .Blue;                      // assignment (d is a Color)
let p = Pair { .a = .Blue, .b = .Ok };   // per-field type
let eq = c == .Green;           // inferred from the peer operand
```

## Swizzles

An array type tagged `@(swizzle("xyzw"))` allows components to be selected by name. A single component or a contiguous ascending run is addressable (a reference into the storage). A reordered or gapped selection gathers a fresh copy. Assignment always writes through, component by component.

```biron
@(swizzle("xyzw"))
type Vec4 = [4]Sint32

let v: Vec4 = Vec4 { 10, 20, 30, 40 };
let x   = v.x;    // component 0
let zw  = v.zw;   // a contiguous [2]Sint32 view, addressable
let yx  = v.yx;   // reordered, gathered into a new [2]Sint32
v.x = 7;          // writes component 0
```

## Tuple explosion

The explode operator `~x` splices the elements of a tuple, struct, or fixed array into a comma-separated list. It works in call arguments, aggregate literals, and method receivers.

```biron
fn sum3(a: Sint32, b: Sint32, c: Sint32) -> Sint32 { return a + b + c; }

let t = (1, 2, 3);
let r = sum3(~t);          // sum3(1, 2, 3)

let p = (20, 30);
let m = sum3(10, ~p);      // mixes with ordinary arguments
```

Explode also builds larger aggregates from smaller ones.

```biron
type Vec = struct { x: Sint32, y: Sint32, z: Sint32 }

let a = (1, 2);
let b = (0, ~a, 3);        // the tuple (0, 1, 2, 3)
let v = Vec { 7, ~a };     // { x = 7, y = 1, z = 2 }
```

And it spreads into a multi-value method receiver.

```biron
fn(a: Sint32, b: &Sint32) store(v: Sint32) { b = a + v; }

let r = (2, 0);
(~r).store(40);            // spreads r into the (a, b) receiver
```
