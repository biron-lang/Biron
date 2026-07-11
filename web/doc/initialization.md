# Initialization

A value can be initialized in two ways. The direct form supplies an expression of the value's own type. Aggregate initialization, written `T { ... }`, is the second form, and Biron permits it on any type rather than only the aggregate types, so one syntax initializes everything from a scalar to a struct. This chapter covers the direct form in brief and then the aggregate form, together with the single rule that governs what its braces may hold. The literal forms of each aggregate, with their fields, elements, and cursor conventions, are in [Aggregates & Literals](#aggregates).

## Direct initialization

A binding takes an expression of its type directly. A union is set from one of its variants, and an optional from a value of its base type or from an empty optional.

```biron
let n: Sint32  = 10;
let o: ?Sint32 = 5;    // an optional, present, holding 5
```

## Aggregate initialization

`T { ... }` is a single syntax that constructs a value of any type. On the aggregate types it fills fields and elements, and on every other type it constructs from a single value. One rule covers both.

### The single value form

`T { x }` is valid whenever `x` is assignable to `T`, and the result is `x` taken as `T`. When `x` already has type `T` the result is a copy of the whole value. This holds for every type, so any value can be constructed from a single element aggregate, including a scalar.

```biron
let a = [3]Uint32 { 10, 20, 30 };
let b = [3]Uint32 { a };   // a is a [3]Uint32, so b is a copy of a
let n = Uint32 { 10 };     // a scalar, built from one value
```

### Field and element lists

A struct, an array, and a tuple are structural aggregates, so the braces may instead hold a list of fields or elements. The list is positional or named, and any slot left out is zeroed.

```biron
type Point = struct { x: Sint32, y: Sint32 };

let p = Point { .x = 3, .y = 4 };   // a field list
let q = Point { 3, 4 };             // positional
let z = [4]Sint32 { 7, 8 };         // the remaining two elements are zeroed
```

The single value form and the list form never collide. An initializer is read as a copy only when its type is the whole aggregate, for example `[3]Uint32 { a }` above, and as the first field or element otherwise, for example `[1]Uint32 { 10 }`, where `10` fills element zero.

### Unions and optionals

A union and an optional are tagged scalars rather than structural aggregates. Only the single value form applies to them, and a field or element list is rejected.

A union takes one value of a variant type, which sets that variant.

```biron
type V = union { Sint32, Bool };

let a: V = 42;       // the direct form
let b = V { 42 };    // the aggregate form, the same result
```

An optional `?T` takes one value of type `T`, which sets the present case, or one value of type `?T`, which copies it. The empty `{}` is the none case.

```biron
let x = [1]Uint32 { 10 };
let some: ?[1]Uint32 = { x };    // present, a copy of x
let copy: ?[1]Uint32 = { some }; // a copy of the optional some
let empty: ?[1]Uint32 = {};      // none
```

Since the list form does not apply, filling an optional or a union element by element is rejected. An optional wraps a whole value, so `?[1]Uint32 { 10 }` is an error, because `10` is neither a `[1]Uint32` nor a `?[1]Uint32`, and `?[2]Uint32 { 10, 20 }` is an error for the same reason.

> [!NOTE]
> An optional can be read as a `union { (), T }`, where the unit case is none. Both are tagged scalars, so the same single value rule governs how they are built.

An optional is tested and refined with `if`, and a union with `is`. Applying `is` to an optional is rejected, since an optional has a presence test rather than a set of variants. Narrowing is described in [Optionals & Unions](#optionals-unions).

## Uninitialized values

A binding whose type transitively holds a pointer, a reference, or a function value must be given a value, since an omitted slot would be zeroed and none of those has a valid zero. Every such field or element must be covered. An optional and a slice are exempt, because each has its own valid empty form, `none` and the empty slice.

```biron
let p: *Sint32;        // an error, a pointer has no valid zero
let a: [4]Sint32;      // fine, an integer array may be left uninitialized
```
