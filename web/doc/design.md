# The design of Biron

Biron is built from a few principles that are held everywhere, without exception. The reason for holding them consistently rather than case by case is that consistency makes the language predictable. Once a general rule is understood, a feature that seems like it ought to work usually does, because the same rule is in effect throughout and nothing special was added to break it. This chapter states the principles and shows where they lead.

## Expressive power

The word expressive is used in more than one way, and the sense meant here is the semantic one. It does not mean concise or pleasant syntax. It is also a separate concern from the absence of syntactic holes, which is a goal of its own below. What is meant is the size of the vocabulary of behaviors the language is able to describe at all.

There is a precise test for when a construct adds power of this kind. A construct adds none if it can be introduced by a local, macro-like translation, one that rewrites each occurrence of the construct in place and leaves the rest of the program structurally untouched. For instance in the lambda calculus a `let` binding adds no power, because it expands to an application of a lambda that already exists, so `let` is only sugar, a change of notation with no change in what the program means. A construct genuinely adds power only when it cannot be introduced this way, when adding it forces the surrounding program to be restructured rather than rewritten in place.

Biron aims for power in exactly this sense, enough that the behaviors a programmer actually needs are expressible within the language rather than built into it as privileged features. Control, state, and whatever effects are central to a given domain should be things the language is able to describe, not fixed constructs granted by the compiler. It is for this reason that algebraic effects have to exist, because what an effect captures, the passing of an operation to a handler defined elsewhere and the resumption of the code that performed it, is exactly the kind of behavior that no local rewrite can add. See [Effects & Hermeticity](#effects).

The goal is not that programs can be written concisely. It is that the semantic vocabulary is large enough for the common reality on its own, and user-extensible for everything beyond it. A language designed this way lets a user add the power a problem calls for rather than depending on the language to have provided it in advance.

## Generality, not special cases

A feature that exists for one purpose, written in its own bespoke way, is a cost even when it is convenient. It adds a rule that has to be learned on its own and that composes with nothing else. When a one-off feature appears in a language, it is a sign that a more general idea was missed.

The function form is one such instance. A function is a set of generic parameters, a receiver, ordinary parameters, effects, and a return, and each of those is optional. There is no separate syntax for a method and no separate syntax for a closure that is valid only in some positions. A receiver is a parameter group before the name, and a single receiver reads as a method, which is a perfectly idiomatic way to write code, but nothing forces that reading. A receiver may bind more than one value, and a receiver value may be a value with value semantics, a pointer, or a reference. The method-looking case is one point inside a form that already accounts for the rest.

The spread operator is a second. `...expr` expands a composite, whether a tuple, an array, or a struct, into the comma-separated list of its elements. The single rule is that any comma-separated list may go wherever such a list is expected, so an array can spread into a tuple, a tuple of numbers into an array of numbers, and a struct's fields into a call's arguments, and the type check decides afterward whether the result is valid. The same operator used where a type is expected composes types the same way. One idea covers values and types alike, everywhere a comma-separated list appears.

Inline assembly is a third. In most languages it is a statement form with its own grammar and its own set of options. In Biron it is a type. `asm("template")` is the type of an assembly block, a value of it is an aggregate of operands and clobbers, and running the block is a call on that value. It passes through a generic, it can be a constant, it can be a field of a struct, and it is written with an aggregate initializer, because it already is those things and no new construct was introduced for it. See [Inline Assembly](#asm).

The effect is that the language can be trusted. When the rules are general, an idea that looks reasonable is usually allowed, because it follows from a rule already in effect rather than depending on whether a special case happened to be written for it.

## No ambiguity in the syntax

The grammar is context free. A source file is parsed without a symbol table and without lookahead, so the meaning of a piece of text never depends on a declaration elsewhere or on tokens further ahead. Much of the design exists to keep it that way.

The same freedom from context holds after the parse. The phase that checks a program never has to work out what a construct is, only whether it is well-typed, because what each construct is was already settled by the way it was written. A fixed array is spelled `[N]T` and is always a fixed array. Nothing later has to discover that `N` was a type all along and that the array is really an enumerated one, because an enumerated array has its own spelling, `[enum; E]T`, fixed at the point it is written. The rule is general. No phase after the parse decides what a thing is. Its identity is fixed by construction, and all that remains is to check that the types and the meaning are right.

The firmer half of this goal is a refusal to add convenience syntax that works in most places and then needs a different, disambiguating form in the places where it would be ambiguous. That pattern is common. A language offers a short form nearly everywhere and asks for a longer one only in the few spots where the short form would collide with something else. Biron treats this as harmful rather than helpful.

Generic instantiation is the standing example. Biron always uses the turbofish, `generic::[T]`, and never `generic[T]`. The bare-bracket form could be permitted in the many contexts where it does not collide with array indexing, and the turbofish asked for only where it does. That is the exact compromise Biron declines. A rule that holds in most contexts but not all is a rule that cannot be relied on, and the whole point of the syntax is that it can be. When one form is used everywhere, an expression that looks like it should parse does parse, with no exception to keep in mind. See [Generics](#generics).

## No expressivity holes

A hole is an idea that can be expressed almost everywhere and then, in one particular place, cannot, because something there is special. The expressiveness holds up to that one place and stops there.

Holes of this kind are easy to find in other languages. In C++ a reference or pointer can be formed to nearly any function, a member function or an overloaded operator included, but not to a constructor or a destructor, since those have no name to refer to. The `this` pointer can be read but not assigned, though any other pointer can. In Odin and Zig the compile-time type and constant parameters are part of the ordinary argument list, which reads well until a generic has to be instantiated without being called, in order to force its code to be generated, or its address has to be taken, and the argument-list form allows neither. In Go a free function may take type parameters but a method may not, so genericity that holds for functions is absent for methods.

Every one of these has reasons behind it, and the reasons may be sound. The position in Biron is that the better move is to design so the decision is never forced. Generic parameters are their own list, kept apart from the ordinary arguments, precisely so a generic can be instantiated without a call and its address can be taken, with no place where those stop being possible. A value of a zero-sized type is still a value, so it can be stored, passed, and addressed like any other, rather than becoming a case that some operations refuse.

The same reasoning governs what Biron leaves out. A range written directly in a loop is a convenience many languages offer, but a range that exists only in that one position is itself a hole, because a range with no name of its own, no way to be stored, and no type is a value the rest of the language cannot describe. Biron declines the loop-only form and enumerates collections through generators instead, where the value being iterated is an ordinary one.

It also decides what Biron includes. Component-wise arithmetic on arrays is present not because array programming is a desirable feature on its own, but because leaving it out would be a hole. A number can be added to a number, and an array is only more numbers, so an array of numbers must be addable too.

A hole is not only a matter of syntax. It appears in semantics as well, where a behavior expressible in most situations becomes inexpressible in one, and that is the concern of the expressive-power goal at the start of this chapter.

## The common reality, not the common case

The common case and the common reality sound alike and are not. The common case is the situation a feature is imagined to serve. The common reality is what a running program actually does. Optimizing for the first is easy and often wrong, because the imagined case turns out to be rare.

Integers are the plain example. It is a common case to want a number that can go negative, so a signed integer is the reflex default. When a running program is audited, though, the reality is that most integers never go negative. A loop counter, an array index, a size, and an offset each live in a strictly non-negative domain. Biron leans on its `Length` type for this reason. `Length` is an unsigned pointer-sized integer and the natural type for a count or an index, so the ordinary case is written in the type that matches what the program actually does. See [Types](#types).

The same reasoning appears again and again. A sentinel such as `-1` for absence is a common-case habit, while the common reality is a value that is either present or not, so absence is written as an optional `?T`. See [Optionals & Unions](#optionals-unions). A string does not need a trailing zero byte in reality, so a `String` is a pointer and a length and is never NUL terminated at the language level. A pointer is tested against null often enough that the reality is code guarding for absence, so a pointer is never null and an absent pointer is written `?*T`, which puts the check at the point where the value is used.

Safety follows from this rather than being aimed at on its own. A language that steers its user toward the common reality tends to be safer, not because a rule was added to make it safe, but because the common reality is already the safer thing to have written in the first place.
