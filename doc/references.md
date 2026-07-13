# References & Pointers

Biron has two ways to talk about the storage of a value rather than the value itself, the **reference** `&T` and the **pointer** `*T`. They look similar but behave very differently. A reference is transparent and quietly aliases an existing variable, while a pointer is an explicit machine address that is taken and dereferenced by hand.

## References

A reference `&T` denotes the storage of an existing value and is *transparent*. It is usable anywhere a `T` is, and it is never dereferenced explicitly. Reading a reference reads the value it refers to. Assigning to a reference writes through to that value. It can be thought of as another name for a variable that already exists, like a C++ reference.

```biron
let x: Sint32 = 10;
let rx: &Sint32 = x;   // rx aliases x
rx = 20;               // writes through -> x is now 20
x = 30;                // and the alias tracks it
// rx now reads 30
```

Because the reference collapses on its own, `rx` is used directly as a `Sint32`. There is no `*` to write.

### Inference collapses a reference to a copy

This is the single most important rule. When type inference picks the type of a binding, a reference is **read and copied** into a fresh value. A real alias is obtained only when the `&T` annotation is written explicitly.

```biron
let w = a[i];          // w: Sint32, an independent COPY
let r: &Sint32 = a[i]; // r: &Sint32, a real alias into the array
```

An indexed element yields storage, so `r` tracks later writes to `a[i]`, while `w` was frozen at the moment it was copied. The same rule applies at call arguments, at `return`, and at assignment. Without a `&T` type on the receiving side, a copy is produced.

### Binding a reference needs an lvalue

Binding a `&T` from a value takes the address of that value, so the source must have storage, meaning a variable, an indexed element, a struct field, a tuple element, or a pointer dereference. Binding a reference to a temporary is an error.

```biron
fn bump(x: &Sint32) { x += 1; }   // aliases the argument

let p = 10;
bump(p);            // legal: p has storage, and is mutated in place
// bump(10);        // error: a literal has no storage to bind
```

> [!IMPORTANT]
> Assigning to a reference assigns to its referent. It never rebinds the reference to point somewhere else.

## Writing through a reference

Since a `&T` parameter or receiver *is* the caller's storage, writing to it, to one of its fields, or to a tuple element is observed by the caller. This makes references the idiomatic way to pass something that is intended to be mutated.

```biron
type Pair = struct { a: Sint32, b: Sint32 }

fn set_a(p: &Pair, v: Sint32) { p.a = v; }  // interior field write

fn(self: &Sint32) put(v: Sint32) { self = v; }  // reference receiver

let b = Pair { a = 1, b = 2 };
set_a(b, 99);       // b.a is now 99

let n: Sint32 = 1;
n.put(50);          // n is now 50
```

A struct field access, a tuple element `t.0`, and an indexed element `a[i]` each yield a reference into the aggregate, so they are lvalues that can be bound to a `&T` or assigned to directly.

## Pointers

A pointer `*T` is an explicit pointer. An address is taken with `&` and dereferenced with `*`. Unlike a reference, a pointer never collapses. The `*` must be written every time the pointee is wanted.

```biron
fn set_ptr(p: *Sint32) { *p = 99; }   // explicit deref to write

let s = Pair { a = 1, b = 2 };
set_ptr(&s.b);      // s.b is now 99

let t = (5, 6);
let r = &t.1;       // r: *Sint32, interior pointer to the tuple field
*r = 42;            // t.1 is now 42
```

Because a reference is transparent, taking its address gives a pointer to its *referent*, not to the reference's own slot. So for `x: &T`, the expression `&x` has type `*T`. (A pointer to a reference, `*&T`, is meaningless and rejected, whereas a reference to a pointer, `&*T`, is fine.)

## Many-item pointers

A many-item pointer `[*]T` has the same machine representation as `*T`, a bare address with no length. Unlike a plain `*T` it may be indexed and sliced. Indexing `p[i]` yields a reference `&T` to the element at that offset, so it is an lvalue that reads as a copy, binds as a reference, and can be assigned. A plain `*T` allows neither indexing nor slicing.

Slicing a many-item pointer forms a length only when an upper bound is given. `p[:hi]` and `p[lo:hi]` produce a `[]T` slice of `hi - lo` elements starting at `lo`. `p[lo:]` has no upper bound and no length to form, so it stays a `[*]T` advanced by `lo`.

The two pointer kinds do not convert on their own. A `*T` becomes a `[*]T` with an explicit `as!` cast, an assertion that the address points at a run of elements. A `[*]T` becomes a `*T` by taking the address of an element, so `&p[0]` is the pointer to the first element.

```biron
let x: [4]Uint8;
let p = &x[0] as! [*]Uint8;   // an explicit `as!` forms a many-item pointer
let first: Uint8 = p[0];     // indexing yields the element
let rest = p[1:];            // no upper bound, still a [*]Uint8
let two: []Uint8 = p[:2];    // an upper bound forms a []Uint8
let back: *Uint8 = &p[0];    // a plain pointer to the first element
```

## The value / reference conversion matrix

Every crossing between a value `T` and a reference `&T`, at a binding, a call argument, a `return`, or an assignment, follows one of four rules.

| destination | source | result |
|---|---|---|
| `T` | `&T` | copies the referent (the reference is read) |
| `&T` | `&T` | passes the same reference through |
| `&T` | `T`  | takes the address of the source (needs an lvalue) |
| `T` | `T`  | copies the value |

> [!TIP]
> The practical takeaway is that an unannotated binding lands in one of the *copying* rows. A real alias is obtained only by writing the type `&T` on the destination.

## No null or uninitialized pointers

A pointer is never null, a reference is never unbound, and a function value is never null. It follows that any type that transitively holds one of these can never be zero or left uninitialized.

- A binding of such a type must be initialized. Both `let p: *T;` and `let p: *T = {};` are errors.
- A struct or array literal may not omit a field or element of such a type, because the omitted slot would be zeroed.

Optionals `?T` and slices `[]T` are exempt, since each has its own valid empty form (`none` and an empty slice). A plain aggregate such as `[N]Sint32` holds no pointer, so it may be left uninitialized.

## The Address type

`Address` is the raw pointer, Biron's `void*`. Any pointer implicitly widens to it, and an `as!` cast recovers a typed pointer. It round-trips through an integer, which is how a null or sentinel is expressed.

```biron
let x: Sint32 = 42;
let p: *Sint32 = &x;
let a: Address = p;          // any pointer widens to Address
let back = a as! *Sint32;     // cast recovers the typed pointer
// *back == 42

let nil = 0 as! Address;      // integer -> Address for a sentinel
```

A reference does not widen on its own. Its address must be taken first (`&r` gives a `*T`, which then widens). One safety rule applies to typed pointer and reference casts. An `as!` cast may **lower** or keep the alignment its referent needs, but may not **raise** it, so `*Uint8 as! *Uint16` is rejected. `Address` is the one exemption, so `(p as! Address) as! *Uint16` is the explicit way to assert the real alignment.
