# The design of Biron

Biron is built from a few principles that are held everywhere, without exception. Applying them consistently rather than case by case is what makes the language predictable. Once a general rule is understood, a feature that seems like it ought to work usually does, because the same rule is in effect throughout and nothing special was added to break it. This chapter states the principles and shows where they lead.

## Expressive power

The word expressive is used in more than one way, and the sense meant here is the semantic one, the size of the vocabulary of behaviors the language can describe. It does not mean concise or pleasant syntax, and it is a separate concern from the absence of expressivity holes, which is a goal of its own below.

There is a precise test for when a construct adds power of this kind. It adds none if it can be introduced by a local, macro-like translation, one that rewrites each occurrence in place and leaves the rest of the program structurally untouched. In the lambda calculus a `let` binding adds no power, because it expands to an application of a lambda that already exists, so `let` is only sugar, a change of notation with no change in what the program means. A construct adds power only when it cannot be introduced this way, when adding it forces the surrounding program to be restructured rather than rewritten in place.

Biron aims for power in this sense, enough that the behaviors a programmer needs are expressible within the language rather than built into it as privileged features. Control, state, and whatever effects are central to a given domain should be things the language can describe, not fixed constructs granted by the compiler. An effect is an ordinary declared type that a signature lists, so the vocabulary is open rather than a fixed set of keywords.

```biron
type Log = struct {}                              // an effect is a declared type
fn note(n: Sint32) <Log> -> Sint32 { return n; }  // a signature lists it in <...>
```

It is for this reason that algebraic effects have to exist, because what an effect captures, the passing of an operation to a handler defined elsewhere and the resumption of the code that performed it, is the kind of behavior that no local rewrite can add. See [Effects & Hermeticity](#effects). The goal is not that programs can be written concisely. It is that the semantic vocabulary is large enough for the common reality on its own, and user-extensible for everything beyond it, so a user adds the power a problem calls for rather than waiting for the language to provide it.

## Generality, not special cases

A feature that exists for one purpose, written in a bespoke way, is a cost even when it is convenient. It adds a rule that has to be learned on its own and composes with nothing else. When a one-off feature appears in a language, it is a sign that a more general idea was missed.

The function form is one such instance. A function is a set of generic parameters, a receiver, ordinary parameters, effects, and a return, and each of those is optional. There is no separate syntax for a method, and none for a closure that is valid only in some positions. A receiver is a parameter group before the name, and a single receiver reads as a method, though nothing forces that reading, since a receiver may bind more than one value and each may be taken by value, by pointer, or by reference.

```biron
type Vec = struct { x: Sint32, y: Sint32 }
fn(v: Vec) sum() -> Sint32 { return v.x + v.y; }   // one receiver, so v.sum() reads as a method

let s = Vec { 3, 4 };
let n = s.sum();                                    // 7
```

The spread operator is a second. `...expr` expands a composite, whether a tuple, an array, or a struct, into the comma-separated list of its elements. The single rule is that any comma-separated list may go wherever such a list is expected, so an array can spread into a tuple, a tuple of numbers into an array of numbers, and a struct's fields into a call's arguments, and the type check decides afterward whether the result is valid. The same operator used where a type is expected composes types the same way.

```biron
type Vec3 = struct { x: Sint32, y: Sint32, z: Sint32 }

let t = (1, 2);
let v = Vec3 { 7, ...t };   // { x = 7, y = 1, z = 2 }
```

Value construction is a third. The braced form `T { ... }` builds a value of any type, not only a struct or an array but a scalar, a tuple, and a zero-sized type as well, so there is one way to write a value rather than a separate constructor for each kind. Dropped to `{ ... }`, it takes its type from the context, and dropped again to `{}`, it is the zero value of any type. The unit type follows from the same rule without one of its own, an empty tuple `()` whose only value is `{}`, so a function that returns unit returns that value and nothing about unit is a special case.

```biron
let a = Uint32 { 10 };   // build any type with braces
let z: Uint32 = {};      // {} is the zero of whatever is wanted
fn nothing() { return {}; }
```

Inline assembly is a fourth. In most languages it is a statement form with its own grammar and set of options. In Biron it is a type. `asm("template")` is the type of an assembly block, a value of it is an aggregate of operands and clobbers, and running the block is a call on that value. It passes through a generic, it can be a constant, it can be a field of a struct, and it is written with an aggregate initializer, because it already is those things and no new construct was introduced for it. See [Inline Assembly](#asm).

The result is that the language can be trusted. When the rules are general, an idea that looks reasonable is usually allowed, because it follows from a rule already in effect rather than depending on whether a special case happened to be written for it.

## No ambiguity in the syntax

The grammar is context free. A source file is parsed without a symbol table or lookahead, so the meaning of a piece of text never depends on a declaration elsewhere or on tokens further ahead. Much of the design exists to keep it that way.

The same freedom from context holds after the parse. The phase that checks a program never has to work out what a construct is, only whether it is well-typed, because each construct's identity was settled by the way it was written. A fixed array is spelled `[N]T` and is always a fixed array. Nothing later has to discover that `N` was a type all along and that the array is an enumerated one, because an enumerated array has its own spelling, `[enum; E]T`.

```biron
type Dir = enum { N, S, E, W }

let a: [4]Sint32          = { 1, 2, 3, 4 };            // always a fixed array
let b: [enum; Dir]Sint32  = { N = 1, S = 2, E = 3, W = 4 };  // an enumerated array, its own spelling
```

No phase after the parse decides what a thing is. Its identity is fixed by construction, and all that remains is to check that the types and the meaning are right.

The firmer half of this goal is a refusal to add convenience syntax that works in most places and then needs a different, disambiguating form where it would be ambiguous. A language offers a short form nearly everywhere and asks for a longer one only in the few spots where the short form would collide with something else. Biron treats this as harmful rather than helpful. Generic instantiation is the standing example. Biron always uses the turbofish, `generic::[T]`, and never `generic[T]`, though the bare-bracket form could be permitted wherever it does not collide with array indexing.

```biron
fn[T: Type] id(x: T) -> T { return x; }

let f = id::[Sint32];   // instantiated with no call, the same form everywhere
let n = f(5);
```

A rule that holds in most contexts but not all cannot be relied on, and the whole point of the syntax is that it can be. The semicolon is the same bargain. Biron requires one at the end of a statement, and it would be easy to make it optional and insert it automatically, requiring an explicit one only where the code would otherwise be ambiguous. Biron declines that for the same reason the turbofish does, so the terminator is written every time and its presence is never something the grammar or a reader has to infer.

## No expressivity holes

A hole is an idea that can be expressed almost everywhere and then, in one particular place, cannot, because something there is special. The expressiveness holds up to that one place and stops there.

Holes of this kind are easy to find in other languages. In C++ a pointer can be formed to nearly any function, a member function or an overloaded operator included, but not to a constructor or a destructor, since those have no name to refer to, and the `this` pointer can be read but not assigned though any other pointer can. C++ stopped pretending to be consistent decades ago. Forty years of features have left it with more special cases than a tax code, each rule shadowed by the one place it politely stops applying.

```cpp
struct Widget {
    Widget();
    void draw();
};

auto p = &Widget::draw;    // fine
auto c = &Widget::Widget;  // error: cannot take the address of a constructor
```

In Odin and Zig the compile-time type and constant parameters are part of the ordinary argument list, which reads well until a generic must be instantiated without being called, to force its code to be generated, or must have its address taken, neither of which the argument list allows. Zig is the worst offender of the lot, with more holes than a spaghetti strainer at a shotgun convention. In Go a free function may take type parameters but a method may not, so genericity that holds for functions is absent for methods. Go fails from the other direction. Its minimalism is the kind that saves a keyword and spends your afternoon, sooner making you copy a function out four times than let a method take a type parameter of its own.

```go
func Map[T, U any](xs []T, f func(T) U) []U { return nil }   // fine

type Set[T any] struct{}
func (s Set[T]) Map[U any](f func(T) U) Set[U] { /* ... */ }
// error: method must have no type parameters
```

Every one of these has reasons behind it, and they may be sound. The better choice is to design so the decision is never forced. Generic parameters are their own list, kept apart from the ordinary arguments, precisely so a generic can be instantiated without a call and its address can be taken, with no place where those stop being possible. A value of a zero-sized type is still a value, so it can be stored, passed, and addressed like any other, rather than becoming a case that some operations refuse.

```biron
let z: struct{} = {};   // a zero-sized value
let p = &z;             // still has an address, like any other value
```

The same reasoning governs what Biron leaves out. A range written directly in a loop is a convenience many languages offer, but a range that exists only in that one position is itself a hole, because one with no name, no way to be stored, and no type is a value the rest of the language cannot describe. Biron declines the loop-only form and enumerates collections through generators instead, where the value being iterated is an ordinary one. The reasoning also decides what Biron includes. Component-wise arithmetic on arrays belongs in the language not because array programming is a desirable feature on its own, but because leaving it out would be a hole, since a number can be added to a number and an array is only more numbers.

A hole is not only a matter of syntax. It appears in semantics as well, where a behavior expressible in most situations becomes inexpressible in one, and that is the concern of the expressive-power goal at the start of this chapter.

## References are ordinary values

A language that treats `&` and `*` as explicit still tends to run a second mode where they are not. Field access, indexing, an assignment target, and a method receiver each insert a borrow or a dereference that was never written. In Rust a field read through a reference is spelled as though the reference were the value, and a method call adds a borrow and however many dereferences resolution needs. Rust talks the loudest about explicit references and quietly inserts the most, a dereference for every dot you write.

```rust
let r: &Foo = &foo;
let x = r.field;   // read as (*r).field
foo.method();      // an implicit borrow: Foo::method(&foo)
```

Go inserts the address-of and dereference operators around a method receiver on its own.

```go
type Point struct{ x int }
func (p *Point) bump() { p.x++ }

var pt Point
pt.bump()   // rewritten as (&pt).bump()
```

C++, Swift, Zig, and Odin each do a version of the same. Swift dresses a computed property in the same `.x` as a stored one, so a place might be memory or might be a function call and the surface never says which. Odin dereferences a pointer for you at every `.`, the same implicit step under a different name. The justification usually given for explicit references is that implicit behavior surprises a reader, yet these are the positions where it happens.

Biron removes the second mode by making a reference an ordinary type. A `&T` is a real value, and it is transparent, so it reads as a `T` wherever one is wanted with no written `*`. A place such as `obj.field` or `a[i]` is then an ordinary expression of type `&T`, a first-class value that can be stored and passed like any other rather than a position with a hidden rewrite.

```biron
type P = struct { field: Sint32 }

let p = P { 5 };
let x = p.field;   // p.field has type &Sint32, read as Sint32 with no written *
```

One rule then holds in every position, so there is no second mode for the language to switch into and nothing implicit left for a reader to reconstruct.

## The common reality, not the common case

The common case and the common reality sound alike and are not. The common case is the situation a feature is imagined to serve. The common reality is what a running program actually does. Optimizing for the first is easy and often wrong, because the imagined case turns out to be rare.

Integers are the plain example. It is a common case to want a number that can go negative, so a signed integer is the reflex default. When a running program is audited, though, the reality is that most integers never go negative. A loop counter, an array index, a size, and an offset each live in a strictly non-negative domain. Biron leans on its `Length` type for this reason, an unsigned pointer-sized integer that is the natural type for a count or an index, so the ordinary case is written in the type that matches what the program actually does. See [Types](#types).

The same reasoning appears again and again. A sentinel such as `-1` for absence is a common-case habit, while the common reality is a value that is either present or not, so absence is written as an optional `?T`. See [Optionals & Unions](#optionals-unions). A string does not need a trailing zero byte in reality, so a `String` is a pointer and a length, never NUL terminated at the language level. A pointer is tested against null often enough that the reality is code guarding for absence, so a pointer is never null and an absent pointer is written `?*T`, which puts the check at the point where the value is used.

```biron
fn first(p: ?*Sint32) -> Sint32 {
	if p { return *p; }   // the check happens where the value is used
	return 0;
}
```

Division shows the same instinct. In the common case an integer division produces a quotient, but the common reality is that a divisor can be zero, so `/` and `%` yield an optional `?T` that is none on a zero divisor.

```biron
fn div(a: Sint32, b: Sint32) -> Sint32 {
	let q = a / b;        // q has type ?Sint32
	if q { return q; }    // narrowed to Sint32 inside the check
	return -1;
}
```

Code that has already established a nonzero divisor opts out with an `@(unsafe_div)` scope, where the operators produce a plain `T` again. The safe form is the default because the failure it guards against is the ordinary situation rather than the exceptional one.

Safety follows from this rather than being aimed at on its own. A language that steers its user toward the common reality tends to be safer, not because a rule was added to make it safe, but because the common reality is already the safer thing to have written.
