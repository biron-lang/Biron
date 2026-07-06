# Types

Biron is statically typed. Every value has a type known at compile time, and the language provides a small set of built-in scalar types plus a handful of [*type constructors*](https://en.wikipedia.org/wiki/Type_constructor) for building pointers, arrays, tuples, and composites out of them. This chapter is a tour of that vocabulary. Aggregate literals, optionals, and unions each have their own chapter. This one focuses on the types themselves and how they relate, including the difference between value and reference semantics.

## Built-in scalars

The primitive numeric and boolean types are always available.

| Category | Types |
| --- | --- |
| Boolean | `Bool`, `Bool8`, `Bool16`, `Bool32`, `Bool64` |
| Signed integers | `Sint8`, `Sint16`, `Sint32`, `Sint64`, `Sint128` |
| Unsigned integers | `Uint8`, `Uint16`, `Uint32`, `Uint64`, `Uint128` |
| Floats | `Real16`, `Real32`, `Real64` |

The floating-point types are `Real16`, `Real32`, and `Real64`. The 128-bit integers and the half-width `Real16` are genuine numeric types that can be computed with directly.

```biron
let a: Sint128 = 100;
let b: Sint128 = 7;
let big: Uint128 = 10000000000;
let wide = big * big;          // 10^20, spans 128 bits
let h: Real16 = 1.5;
let g: Real16 = 2.25;
let sum = h + g;               // 3.75, exact in a half float
```

### Booleans

`Bool` is the ordinary boolean and is always one byte. The sized booleans `Bool8`, `Bool16`, `Bool32`, and `Bool64` exist for when the exact width of a boolean matters, most often in C interop where a boolean field or argument has a fixed size. `Bool8` is one byte just as `Bool` is, yet it is a distinct type, so the two do not coerce to one another on their own.

A boolean expression, whether `Bool` or a sized boolean, converts implicitly to `Bool` in the condition of an `if` and in the condition of a ternary, and in no other position. Anywhere else a sized boolean keeps its own type, and an explicit `as` cast is required to move between the boolean types.

## String, Length, Address, and Type

Four built-in types are special enough to call out on their own.

### String

A `String` is a fat pointer, a pair of a data pointer and a length. It is **never NUL-terminated** at the language level, so the length is stored alongside the data rather than marked by a trailing zero byte. String literals use C-style backslash escapes.

```biron
let s: String = "Hello, world\n";
```

### Length

`Length` is a distinct pointer-sized unsigned integer. Its width is the number of bytes needed to reference any location in memory, so it is 4 bytes on a 32-bit platform and 8 bytes on a 64-bit platform. `Length` is the native index type used for array indexing, and for measuring sizes. It has its own identity and does **not** implicitly coerce to an ordinary integer such as `Uint64`. Crossing between the two requires an explicit `as` cast.

### Address

`Address` is a distinct raw pointer, the type `*()` (a pointer to unit) and Biron's analogue of C's `void*`. Any typed pointer widens to it implicitly, an `as` cast recovers a typed pointer, and it round-trips through an integer so that a null or sentinel value can be expressed.

```biron
let x: Sint32 = 42;
let p: *Sint32 = &x;
let a: Address = p;            // a pointer widens implicitly
let back = a as *Sint32;       // a cast recovers the typed pointer
let nil = 0 as Address;        // an integer round-trips for a sentinel
```

A reference does not widen to `Address` on its own. Its address must be taken with `&` first, which gives a pointer. Like any pointer, an `Address` cannot be dereferenced until it is cast back to a typed pointer.

### Type

`Type` is the type of types. It is only legal as the *kind* of a generic parameter, where it marks a parameter that stands for a type rather than a value.

```biron
fn[T: Type] identity(x: T) -> T { return x; }
```

## Type constructors

From any type `T` a new type can be built. These constructors are the heart of the type system.

| Written | Meaning |
| --- | --- |
| `*T` | pointer to `T` |
| `&T` | reference to `T` |
| `?T` | optional `T` |
| `@T` | atomic `T` (integer or pointer only) |
| `[]T` | slice of `T` |
| `[N]T` | fixed array of exactly `N` elements |
| `[static; N]T` | growable array, capacity `N`, in place |
| `[dynamic]T` | growable array, allocated as it grows |
| `[dynamic; N]T` | growable array, `N` in place then allocated |
| `[enum; E]T` | array indexed by the enumerators of `E` |
| `(A, B, ...)` | tuple |
| `fn(params) -> R` | function type |

A slice `[]T` is a fat pointer of a data pointer and a length, like `String`. A fixed array `[N]T` is a value type of `N` contiguous elements, while an enumerated array `[enum; E]T` is indexed by an enum's members instead of by integers. The growable kinds `[static; N]T`, `[dynamic]T`, and `[dynamic; N]T` are covered in **Arrays** below.

```biron
fn sum4(a: [4]Sint32) -> Sint32 { return a[0] + a[1] + a[2] + a[3]; }

let colors = [enum; Color]Sint32 { .Red = 1, .Green = 2, .Blue = 3 };
```

A function type describes a function's signature, and a function value is assigned to it directly.

```biron
fn add(a: Sint32, b: Sint32) -> Sint32 { return a + b; }
let f: fn(a: Sint32, b: Sint32) -> Sint32 = add;
let r = f(3, 4);               // 7
```

The composite constructors `struct`, `union`, and `enum` build aggregate types. See **Aggregates & Literals** for how to construct and use them, and **Optionals & Unions** and **References & Pointers** for `?T`, `@T`, `*T`, and `&T` in depth.

## Value and reference semantics

By default a value has *value semantics*. A binding, an argument, a return, and an assignment each act on an independent copy, so a write through one name never disturbs another.

A reference `&T` opts into *reference semantics*. It designates the storage of an existing value rather than a fresh copy, and it is **transparent**. A `&T` is used exactly where a `T` is, with no explicit dereference. A write through a reference acts on the value it refers to.

```biron
fn bump(x: &Sint32) {
	x = x + 1;               // writes through to the caller's variable
}

let n = 10;
bump(n);                     // n is now 11
```

The consequence that matters most is that *type inference collapses a reference to a copy*. An unannotated binding takes a value, even when the initializer points at storage that could be aliased. A real alias is bound only when the destination type is written as `&T`.

```biron
let arr = [3]Sint32 { 1, 2, 3 };
let w = arr[0];              // Sint32, an independent copy
let r: &Sint32 = arr[0];    // a reference that aliases arr[0]
r = 99;                      // arr[0] is now 99, while w is still 1
```

The same rule holds at every binding site. A call argument, a `return`, and an assignment all copy unless the destination is a reference type. Binding a `&T` needs storage to name, so the source must be an lvalue such as a variable, an element, or a field. A temporary has no storage and cannot be bound.

A pointer `*T` is the explicit counterpart. It is written and read out in the open. `&x` takes an address and `*p` dereferences. Neither a pointer nor a reference is ever null. See **References & Pointers** for the complete set of conversions between a value and a reference, the pointer rules, and the no-null guarantee.

## Arrays

An array holds a run of elements of one type. Four kinds cover everything from a plain fixed block to a fully dynamic sequence. They differ only in where the elements are stored and whether the count can grow.

A fixed array `[N]T` is a value of exactly `N` contiguous elements. Its length is always `N`, and it copies whole, like any value.

```biron
let pt = [3]Sint32 { 1, 2, 3 };      // three elements, always three
```

The other three kinds are *growable*. Each has a length that is separate from its capacity and supports appending and slicing. The capacity is how many elements fit before more storage is allocated, the length is how many are present at the moment.

| Written | Capacity | Storage |
| --- | --- | --- |
| `[static; N]T` | fixed at `N` | in place, no allocation |
| `[dynamic]T` | unbounded | allocated, grown as needed |
| `[dynamic; N]T` | unbounded | first `N` in place, allocated past `N` |

A `[static; N]T` holds its elements in place with room for `N` of them, so it needs no allocation at all. Appending past `N` cannot succeed, so its append reports whether the element was taken.

```biron
let xs: [static; 8]Sint32 = { 1, 2, 3 };   // length 3, capacity 8
xs.append(4);                               // length 4
```

A `[dynamic]T` places no fixed bound on its length. Its storage is allocated and grown as elements are added, so an append always succeeds. A `[dynamic; N]T` combines the two. It holds up to `N` elements in place and allocates separate storage only once the length exceeds `N`, so the common small case stays free of any allocation while unbounded growth is still available.

An initializer fills from the front, and the length follows the content, not the capacity, the same way a string's length follows its characters.

```biron
let ys: [static; 10]Uint32 = { 10, 20, 30 };   // length 3, not 10
```

Every growable array slices into a plain `[]T`. The slice spans the used portion, so its count is the length rather than the capacity, and it aliases the elements in place. This is the ordinary slicing of **References & Pointers**, with the used length supplying the implicit bound.

```biron
let view: []Sint32 = xs[:];       // a slice over the used elements of xs
```

Appending, length, and slicing are ordinary methods that the core library defines over these kinds, so one interface serves all three.

## Type aliases and named composites

A `type` declaration introduces a name for a type. When the right-hand side is a `struct`, `union`, or `enum` body, it mints a new *named* composite. When it is any other type, it is a plain alias.

```biron
type Point   = struct { x: Sint32, y: Sint32 }
type Color   = enum { Red, Green, Blue }        // 0, 1, 2
type Status  = enum { Ok = 0, Warn = 10, Err }  // 0, 10, 11
type Small   = enum as Uint8 { Lo = 200, Hi }   // underlying Uint8
```

An `enum` gives each member a value. `A = expr` sets it, an unannotated member is the previous one plus one, and the first defaults to zero. `enum as T` chooses the underlying integer type (the default is `Sint32`). A composite may be generic in a type or value parameter.

```biron
type Box  = struct[T: Type] { value: T }
type Pair = struct[A: Type, B: Type] { first: A, second: B }
```

## Nominal versus structural typing

Biron is structurally typed, with one exception. Nominality applies only when a type is *named*. A named `struct`, `union`, or `enum` matches only itself, so two named types with identical layouts are still different types. An **anonymous** composite written inline is structural. It matches any type with the same structure, named or not.

```biron
type Foo = struct { x: String }
type Bar = struct { x: String }
fn test(f: Foo) {}

test(Foo { "Hello" });                    // ok    Foo == Foo
test(Bar { "Hello" });                    // error Bar and Foo are distinct
test(struct { x: String } { "Hello" });   // ok    anonymous structure matches Foo
```

An anonymous composite is valid anywhere a type is, a binding annotation, a parameter, a return, or a field. Structures compare by field name and type (or variant, or enumerator) recursively, and a named type inside a structure still compares nominally.

## Embedding and subtype polymorphism

A struct may *embed* another with `using`. Inside a struct body, a bare member `using A` splices in all of `A`'s fields anonymously. A named field `a: using A` splices them in as well and keeps the embedded `A` available under the name `a`. Embedding composes one structure out of another, and from that it gives subtype polymorphism.

```biron
type A = struct { x: String }
type B = struct {
	using A,             // A's fields, spliced in anonymously
	y: String,
}

let b = B { .x = "Hi", .y = "World" };
let vx: &String = b.x;                   // the embedded A.x, addressable
```

An embedded field is available directly under its own name, so `b.x` denotes the embedded `A.x`. The named form adds a second spelling through the field itself.

```biron
type C = struct {
	a: using A,          // embedded, and also available as `a`
	y: String,
}

let c = C { .x = "Hi", .y = "World" };
let p: &String = c.a.x;                  // the same field as c.x
```

Either spelling is an lvalue, so an embedded field is addressable with `&` and binds to a reference like any other.

A struct that embeds another is a *derived* type of it. A value of the derived type binds to a reference or pointer of the embedded *base* type with no cast, an implicit **downcast**. The reverse, an **upcast** from base to derived, is never implicit and is written as an explicit `as`. Both directions apply to references and pointers alike.

```biron
let d: &A = b;       // downcast, implicit, d.x is "Hi"
let e: *A = &b;      // pointers too
```

A downcast is not a plain reinterpretation. An embedded base may sit anywhere in the derived struct, and one struct may embed several different types, so the conversion refers to the base sub-object wherever it sits. The base is matched by its type, which stays unambiguous because a given type may be embedded only once in a struct.

Embedding composes, so a chain of `using` makes every ancestor a base.

```biron
type Base = struct { tag: Sint32 }
type Mid  = struct { using Base, m: Sint32 }
type Leaf = struct { using Mid,  n: Sint32 }

let leaf = Leaf { .tag = 1, .m = 2, .n = 3 };
let base: &Base = leaf;      // through Mid, then Base
```

Whether the embedded members are named or bare changes only whether the sub-object is also available by name, never the subtyping.

## Untyped literals

Integer and float literals have no type of their own until context fixes one, and that context propagates through arithmetic operators and both arms of a ternary. A wide binding therefore never narrows through a smaller type on the way in.

```biron
let both: Uint128 = 10000000000 + 10000000000;   // both operands are Uint128
let tern: Uint128 = cond ? 30000000000 : 0;       // both branches are Uint128
let peer = a * 4;                                  // 4 adopts a's type
```

A literal paired with a typed operand simply takes that operand's type.

## Explicit conversion with `as`

The `as` operator performs explicit numeric, pointer, and reference conversions. It is the way to cross between types the language will not convert implicitly, such as an enum and its underlying integer, `Length` and `Uint64`, or an `Address` and a typed pointer.

```biron
let n = Color.Green as Sint32;   // enum to its underlying integer
let d = (a / b) as Sint32;       // narrow a wide result
```

> [!CAUTION]
> A pointer or reference cast may **lower** or keep the alignment its referent needs, but it may not *raise* it. `*Uint8 as *Uint16` is rejected, since a byte pointer only promises one-byte alignment. `Address` is the one exemption, so `(p as Address) as *Uint16` is the explicit way to assert the real alignment.
