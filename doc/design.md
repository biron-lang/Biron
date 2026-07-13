# The design of Biron

Biron is built from a few principles that are held everywhere, without exception. Applying them consistently rather than case by case is what makes the language predictable. Once a general rule is understood, a feature that seems like it ought to work usually does, because the same rule is in effect throughout and nothing special was added to break it. This chapter states the principles and shows where they lead.

## Expressive power

The word expressive is used in more than one way, and the sense meant here is the semantic one, the size of the vocabulary of behaviors the language can describe. It does not mean concise or pleasant syntax, and it is a separate concern from the absence of expressivity holes, which is a goal of its own below.

There is a precise test for when a construct adds power of this kind. It adds none if it can be introduced by a local, macro-like translation, one that rewrites each occurrence in place and leaves the rest of the program structurally untouched. In the lambda calculus a `let` binding adds no power, because it expands to an application of a lambda that already exists, so `let` is only sugar, a change of notation with no change in what the program means. A construct genuinely adds power only when it cannot be introduced this way, when adding it forces the surrounding program to be restructured rather than rewritten in place.

Biron aims for power in this sense, enough that the behaviors a programmer needs are expressible within the language rather than built into it as privileged features. Control, state, and whatever effects are central to a given domain should be things the language can describe, not fixed constructs granted by the compiler. It is for this reason that algebraic effects have to exist, because what an effect captures, the passing of an operation to a handler defined elsewhere and the resumption of the code that performed it, is exactly the kind of behavior that no local rewrite can add. See [Effects & Hermeticity](#effects).

The goal is not that programs can be written concisely. It is that the semantic vocabulary is large enough for the common reality on its own, and user-extensible for everything beyond it. A language designed this way lets a user add the power a problem calls for rather than waiting for the language to provide it.

## Generality, not special cases

A feature that exists for one purpose, written in a bespoke way, is a cost even when it is convenient. It adds a rule that has to be learned on its own and composes with nothing else. When a one-off feature appears in a language, it is a sign that a more general idea was missed.

The function form is one such instance. A function is a set of generic parameters, a receiver, ordinary parameters, effects, and a return, and each of those is optional. There is no separate syntax for a method, and none for a closure that is valid only in some positions. A receiver is a parameter group before the name, and a single receiver reads as a method, which is an idiomatic way to write code, but nothing forces it. A receiver may bind more than one value, and each may be taken by value, by pointer, or by reference. The method-looking case is one point inside a form that already accounts for the rest.

The spread operator is a second. `...expr` expands a composite, whether a tuple, an array, or a struct, into the comma-separated list of its elements. The single rule is that any comma-separated list may go wherever such a list is expected, so an array can spread into a tuple, a tuple of numbers into an array of numbers, and a struct's fields into a call's arguments, and the type check decides afterward whether the result is valid. The same operator used where a type is expected composes types the same way. One idea covers values and types alike, everywhere a comma-separated list appears.

Value construction is a third. The braced form `T { ... }` builds a value of any type, not only a struct or an array but a scalar, a tuple, and a zero-sized type as well, so there is one way to write a value rather than a separate constructor for each kind. Dropped to `{ ... }`, it takes its type from the context. Dropped again to `{}`, it is the zero value of any type, coercing to whatever the context wants. The unit type follows from the same rule without one of its own. Unit is the empty tuple `()`, whose only value is `{}`, and a function that returns unit returns that value, which can then be assigned to any type. Nothing about unit is a special case. It is only what the general form already provides.

Inline assembly is a fourth. In most languages it is a statement form with its own grammar and set of options. In Biron it is a type. `asm("template")` is the type of an assembly block, a value of it is an aggregate of operands and clobbers, and running the block is a call on that value. It passes through a generic, it can be a constant, it can be a field of a struct, and it is written with an aggregate initializer, because it already is those things and no new construct was introduced for it. See [Inline Assembly](#asm).

The result is that the language can be trusted. When the rules are general, an idea that looks reasonable is usually allowed, because it follows from a rule already in effect rather than depending on whether a special case happened to be written for it.

## No ambiguity in the syntax

The grammar is context free. A source file is parsed without a symbol table or lookahead, so the meaning of a piece of text never depends on a declaration elsewhere or on tokens further ahead. Much of the design exists to keep it that way.

The same freedom from context holds after the parse. The phase that checks a program never has to work out what a construct is, only whether it is well-typed, because each construct's identity was settled by the way it was written. A fixed array is spelled `[N]T` and is always a fixed array. Nothing later has to discover that `N` was a type all along and that the array is an enumerated one, because an enumerated array has its own spelling, `[enum; E]T`, fixed at the point it is written. The rule is general. No phase after the parse decides what a thing is. Its identity is fixed by construction, and all that remains is to check that the types and the meaning are right.

The firmer half of this goal is a refusal to add convenience syntax that works in most places and then needs a different, disambiguating form where it would be ambiguous. That pattern is common. A language offers a short form nearly everywhere and asks for a longer one only in the few spots where the short form would collide with something else. Biron treats this as harmful rather than helpful.

Generic instantiation is the standing example. Biron always uses the turbofish, `generic::[T]`, and never `generic[T]`. The bare-bracket form could be permitted in the many contexts where it does not collide with array indexing, and the turbofish asked for only where it does. That is the exact compromise Biron declines. A rule that holds in most contexts but not all is a rule that cannot be relied on, and the whole point of the syntax is that it can be. When one form is used everywhere, an expression that looks like it should parse does parse, with no exception to keep in mind. See [Generics](#generics).

The semicolon is another case. Biron requires one at the end of a statement, and it would be easy to make it optional and insert it automatically, requiring an explicit one only in the contexts that would otherwise be ambiguous. That is the same bargain the turbofish refuses, a convenience nearly everywhere in exchange for a special rule where the short form breaks down, and Biron declines it for the same reason. The terminator is written every time, so its presence is never something the grammar or a reader has to infer.

## No expressivity holes

A hole is an idea that can be expressed almost everywhere and then, in one particular place, cannot, because something there is special. The expressiveness holds up to that one place and stops there.

Holes of this kind are easy to find in other languages. In C++ a reference or pointer can be formed to nearly any function, a member function or an overloaded operator included, but not to a constructor or a destructor, since those have no name to refer to. The `this` pointer can be read but not assigned, though any other pointer can. In Odin and Zig the compile-time type and constant parameters are part of the ordinary argument list, which reads well until a generic must be instantiated without being called, to force its code to be generated, or must have its address taken, neither of which the argument list allows. In Go a free function may take type parameters but a method may not, so genericity that holds for functions is absent for methods.

Every one of these has reasons behind it, and they may be sound. The better choice is to design so the decision is never forced. Generic parameters are their own list, kept apart from the ordinary arguments, precisely so a generic can be instantiated without a call and its address can be taken, with no place where those stop being possible. A value of a zero-sized type is still a value, so it can be stored, passed, and addressed like any other, rather than becoming a case that some operations refuse.

The same reasoning governs what Biron leaves out. A range written directly in a loop is a convenience many languages offer, but a range that exists only in that one position is itself a hole, because one with no name, no way to be stored, and no type is a value the rest of the language cannot describe. Biron declines the loop-only form and enumerates collections through generators instead, where the value being iterated is an ordinary one.

It also decides what Biron includes. Component-wise arithmetic on arrays is present not because array programming is a desirable feature on its own, but because leaving it out would be a hole. A number can be added to a number, and an array is only more numbers, so an array of numbers must be addable too.

References are a subtler case. A language that treats `&` and `*` as explicit still tends to run a second mode where they are not. Field access, indexing, an assignment target, and a method receiver each insert a borrow or a dereference that was never written. In Rust `r.field` on a reference means `(*r).field`, and a method call adds a borrow and however many dereferences resolution needs. C++, Go, Swift, Zig, and Odin are inconsistent in different ways, some with implicit reference behavior that cannot be written anywhere else in the language, some arguing for explicit references and then inserting implicit ones for convenience.

Biron removes the second mode by making a reference an ordinary type. A `&T` is a real value, and it is transparent, so it reads as a `T` wherever one is wanted with no written `*`. A place such as `obj.field` or `a[i]` is then an ordinary expression of type `&T`, a first-class value that can be stored and passed like any other rather than a position with a hidden rewrite. One rule holds everywhere, with no second mode to switch into.

A hole is not only a matter of syntax. It appears in semantics as well, where a behavior expressible in most situations becomes inexpressible in one, and that is the concern of the expressive-power goal at the start of this chapter.

## The common reality, not the common case

The common case and the common reality sound alike and are not. The common case is the situation a feature is imagined to serve. The common reality is what a running program actually does. Optimizing for the first is easy and often wrong, because the imagined case turns out to be rare.

Integers are the plain example. It is a common case to want a number that can go negative, so a signed integer is the reflex default. When a running program is audited, though, the reality is that most integers never go negative. A loop counter, an array index, a size, and an offset each live in a strictly non-negative domain. Biron leans on its `Length` type for this reason. `Length` is an unsigned pointer-sized integer and the natural type for a count or an index, so the ordinary case is written in the type that matches what the program actually does. See [Types](#types).

The same reasoning appears again and again. A sentinel such as `-1` for absence is a common-case habit, while the common reality is a value that is either present or not, so absence is written as an optional `?T`. See [Optionals & Unions](#optionals-unions). A string does not need a trailing zero byte in reality, so a `String` is a pointer and a length, never NUL terminated at the language level. A pointer is tested against null often enough that the reality is code guarding for absence, so a pointer is never null and an absent pointer is written `?*T`, which puts the check at the point where the value is used.

Division shows the same instinct. In the common case an integer division produces a quotient, but the common reality is that a divisor can be zero, so `/` and `%` yield an optional `?T` that is none on a zero divisor, and the result has to be checked before it is used. Code that has already established a nonzero divisor opts out with an `@(unsafe_div)` scope, where the operators produce a plain `T` again. The safe form is the default because the failure it guards against is the ordinary situation rather than the exceptional one.

Safety follows from this rather than being aimed at on its own. A language that steers its user toward the common reality tends to be safer, not because a rule was added to make it safe, but because the common reality is already the safer thing to have written.
