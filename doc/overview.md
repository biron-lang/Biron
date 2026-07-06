# Overview

Biron is a statically typed [systems programming language](https://en.wikipedia.org/wiki/System_programming_language) for building robust
applications. It aims to provide the low-level control of a language like C,
with a type system that rules out whole classes of bugs before a program
ever runs. Biron is *safe by construction*. There are no null pointers or
unbound references, and operations that can fail at runtime, like dividing by
zero, are made explicit in the types rather than left to crash.

Alongside that, Biron has a lexically scoped **[effect system](https://en.wikipedia.org/wiki/Effect_system)**. A function must
declare the capabilities it uses, such as performing IO, and it can only access
a capability that some enclosing scope has explicitly granted it. The result is
that code is *[hermetic by default](#effects/hermeticity)*. A function cannot quietly touch the console,
the clock, or any other ambient resource unless it says so in its signature and
a caller supplies it.

## Safe by construction

A few guarantees hold everywhere in Biron, with no way to opt out by accident.

- A pointer is never null, a reference is never unbound, and a function value
  is never null. A value whose type transitively contains one of these must be
  initialized, so a dangling handle can never be read through.
- Optionals (`?T`) are the honest way to model "maybe absent", and the value is
  obtained by narrowing with control flow rather than a blind unwrap.
- Integer `/` and `%` are *checked*. They yield `?T` and produce `none` when the
  divisor is zero, so a stray zero can never fault. The raw, unchecked form is
  opted into deliberately when needed.
- Capabilities are never ambient. A function accesses the outside world,
  such as performing IO, only through **effects** named in its signature and
  granted by a caller. There are no hidden capabilities, so what a function can do
  is visible up front in its type, and nothing touches the outside world by
  surprise.

Together these mean the common footguns of a systems language are simply not
available unless explicitly requested. The effect system extends the same idea
from memory safety to capability safety. A signature is an honest account of what
its function can access.

## The structure of a program

A Biron source file is a flat sequence of top-level declarations. There are five
kinds.

| Declaration | Introduces |
|-------------|------------|
| `fn`        | a function (or method, or associated function) |
| `type`      | a named type, an alias or a `struct`, `union`, or `enum` |
| `const`     | a named compile-time constant |
| `import`    | another module, made available under a namespace |
| `foreign`   | external C symbols to link against |

A mutable global variable is deliberately not among them.[^globals]

Declarations are **order-independent**. The file is collected before it is
checked, so a function may call another that is written later in the file, and
two types may refer to each other freely. Nothing ever has to be
forward-declared, and declarations need not be arranged top-down.

An executable program has an entry point named `main`. Like any function it can
declare effects and a return type. To communicate with the host system, `main`
requests the `system::System` effect declared in the core library, which the
runtime grants it at startup. A `main` that returns nothing simply omits the
return type.

## Hello, World

Here is a complete program that prints a greeting.

```biron
import core.io
import core.system

using io::IO;
using system::System;

fn main() <System> {
	with IO = System!.console;
	io::print("Hello, World!");
}
```

Small as it is, this touches every central idea in Biron. Reading it top to
bottom.

- `import core.io` and `import core.system` pull in two core library
  modules. Each one defines an **effect**. `io` provides the `IO` effect (the
  ability to do input and output), and `system` provides the `System` effect
  (access to the host environment).
- The two `using` lines bring the names `IO` and `System` into the file's scope
  so they may be written unqualified. This is a convenience only. Without them the
  effects would be spelled `io::IO` and `system::System` at each use.
- `fn main() <System>` declares the entry point and says it needs the `System`
  effect. The program's `main` is handed a `System` effect implicitly, holding
  the host's implementations of everything the runtime can do.
- `System!` reads the value of the established `System` effect, and
  `System!.console` selects the console handler out of it. That console happens
  to *be* an implementation of the `IO` effect.
- `with IO = System!.console;` **establishes** the `IO` effect for the rest of
  the enclosing scope, using the console as its handler.
- `io::print("Hello, World!")` needs the `IO` effect to run. Because the `with`
  above put one in scope, the call type checks and the greeting is printed. Had
  the `with` been missing, this line would be a compile-time error. `io::print`
  cannot perform IO out of thin air.

That last point is the whole idea of the effect system in miniature. Doing IO
is a capability that has to be threaded in from `main`, where the host grants it,
down to the code that uses it. Nothing accesses the outside world by surprise.

## Building and running

The compiler is a single command. Building the program above into an
executable is done with the following command.

```
biron hello.biron -o hello
```

This compiles the file, links it, and writes a runnable `hello`. To see what the
compiler is doing to the code, dump flags print the intermediate forms it
produces along the way. `--ast`, for instance, shows the parsed syntax tree.
These are for inspection and debugging, not something needed for an ordinary
build.

## Where to go next

This overview is only the first taste. The rest of the manual works through the
language in depth.

- **Types** — the built-in scalars, `struct`/`union`/`enum`, tuples, arrays and
  slices, optionals, and Biron's structural-versus-nominal type identity.
- **Expressions** — operators (including the `~` explode operator that splices
  a tuple, struct, or array into a comma-separated list), casts, aggregate
  literals, indexing, and flow-sensitive narrowing.
- **Functions** — parameters, references, methods and associated functions,
  generics, function values, and `defer`.
- **Effects & Hermeticity** — declaring, establishing, and reading effects, and the `const`
  effects that are resolved at compile time.
- **Modules** — organizing code across files and directories, imports, and
  visibility with `@(module)` and `@(export)`.

> [!TIP]
> New to Biron? Read Types and Expressions next. They underpin everything else.

[^globals]: Biron has no global mutable state. A value visible to every function could be read or written without appearing in any signature, which would break hermeticity. See [No global mutable state](#effects/no-global-mutable-state) in the Effects chapter.
