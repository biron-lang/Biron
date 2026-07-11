# Modules & Foreign

Biron programs are organized into *modules*, and a module can go outside the language to call C functions. This chapter covers both. It shows how to split code across files, control what each file exposes, and bind to a foreign C library.

## Modules

A module is a directory of `.biron` files compiled together. The files share one flat namespace, so a declaration one file makes visible to its siblings is accessed by its bare name. The root program is itself a module.

Another module is used by importing it under its directory name.

```biron
import "mathmod"
```

This loads the `mathmod/` directory (every `.biron` file in it), resolved relative to the importing file. Its exported members are then available through the namespaced form `mathmod::member`.

```biron
let five = mathmod::add(2, 3);
let ten  = mathmod::mul(2, 5);
```

### Importing under an alias

`import "name" as alias` imports the same module but refers to it as `alias`. The alias is purely a spelling. It refers to the exact same entities, never a second import or a distinct symbol.

```biron
import "mathmod" as m

let five = m::add(2, 3);
```

> [!WARNING]
> A module may be imported only **once** per file. An alias is not a second import
> of the same module, so importing a module twice (with or without an alias) is an
> error.

### Namespaced access

The `module::member` form works for every kind of exported entity, namely functions, types, constants, and generics. Generic functions and types accept an explicit type argument with the turbofish `::[T]`, or infer it from the call.

```biron
import "mathmod" as m

// A generic type from another module, instantiated here.
let r = m::Rational::[Real32] { .num = 22.0, .den = 7.0 };

// A generic function, its type argument inferred from the value.
let a = m::abs(0 - 9);            // 9

// A generic method, called on the receiver.
let sq = 10.squared();           // 100

// An exported constant.
let meaning = m::MEANING;        // 42
```

## Visibility

Every declaration is **private to its file** by default. No other file, not even a sibling in the same module, may name it. Two attributes widen this.

| Attribute     | Visible to                     | Accessed as      |
|---------------|--------------------------------|------------------|
| *(none)*      | its own file only              | bare name        |
| `@(module)`   | sibling files of its module    | bare name        |
| `@(export)`   | the whole program              | `module::name`   |

```biron
// mathmod/helpers.biron

// Visible to sibling files of mathmod, but not to other modules.
@(module) fn triple(x: Sint32) -> Sint32 { return x * 3; }

// Private to this file. Not even a sibling may name it.
fn secret(x: Sint32) -> Sint32 { return x * 2; }
```

```biron
// mathmod/ops.biron

// Reachable from any module as mathmod::add.
@(export) fn add(a: Sint32, b: Sint32) -> Sint32 { return a + b; }

// Uses triple from the sibling file by bare name, because it is @(module).
@(export) fn scaled(x: Sint32) -> Sint32 { return triple(x) + add(x, x); }
```

> [!CAUTION]
> Referring to something that cannot be seen is an error, and the message
> reports which attribute the declaration needs.

## Type identity across modules

Biron is structurally typed, but a *named* type is nominal. It equals only itself. Two named types with an identical layout are still different types, even across a module boundary. So `A::Rational` and `B::Rational` are never the same type.

A `type` declaration always mints a brand-new distinct type, while a `using` declaration gives a transparent alias. The difference matters across modules.

A `type` gives a struct, union, enum, or any other body a fresh identity.

```biron
@(export) type Rational = struct { num: Real32, den: Real32 }
```

A `using` mints nothing. The name is only another name for an existing type.

```biron
@(export) using Id = Sint32          // Id is another name for Sint32
```

Because an alias is transparent, a value typed through it is accepted anywhere the underlying type is expected. If module `B` writes `using Rational = A::Rational`, then `B::Rational` *is* `A::Rational`, and a value of one is a value of the other. An exported alias may even name a type its own module keeps private, and only the alias becomes visible, so `B::Rational` is resolved while the private name behind it is not.

## Foreign functions

A `foreign` block declares external C symbols. Each entry is a function signature, and the block is accessed through its name as a namespace (`libc::printf`). A foreign block **requires** a `@(link)` attribute specifying the library to bind.

```biron
@(link("linktime", "c"))
foreign libc {
	fn printf(fmt: String, ...) -> Sint32,
	fn abs(x: Sint32) -> Sint32,
	fn strlen(s: String) -> Uint64,
}

fn main() -> Sint32 {
	libc::printf("abs = %d\n", libc::abs(0 - 7));
	return libc::strlen("hello") as Sint32;   // 5
}
```

The block name (`libc`) is only the `libc::member` namespace. The library to bind is named by `@(link)`, and the two need not agree.

A foreign block obeys the same visibility attributes as any other declaration, with one limit. `@(module)` on the block shares its `libc::member` functions with the sibling files of the module, and each such file uses them as the external symbols they are. `@(export)` on a foreign block is rejected, since a foreign symbol is external already and widening it past the module would mean nothing.

### Link time vs runtime

The first argument of `@(link)` chooses *when* symbols are resolved.

- `@(link("linktime", "c"))` binds the library at build time.
- `@(link("runtime", "c"))` resolves symbols dynamically at program startup, so each `libc::fn` call goes through a pointer filled in at launch.

The call syntax is identical either way. Only the linking strategy differs.

At a foreign call boundary a Biron `String` (a `{ data, length }` fat pointer) is passed as its inner `const char*`, matching the C prototype. That is why `libc::strlen("hello")` works directly.

### Variadic functions

A trailing `...` in a signature marks a function variadic. Inside a foreign block this is ordinary C varargs, which is how `printf` accepts any number of trailing arguments.

```biron
fn printf(fmt: String, ...) -> Sint32,
```

### Reading variadic arguments

To *read* varargs in a Biron function, the `core/c` module is imported and `c::va_list_t` is used. Its methods `start`, `arg::[T]()`, `end`, and `copy` walk the list.

```biron
import "c"

fn sum3(first: Sint32, ...) -> Sint32 {
	let ap: c::va_list_t;
	ap.start(first);                 // begin after the last named parameter
	let a = ap.arg::[Sint32]();      // read one argument, typed by the turbofish
	let b = ap.arg::[Sint32]();
	ap.end();
	return first + a + b;
}
```

`copy` clones a cursor so the same arguments can be read twice through two independent walks.

> [!IMPORTANT]
> A `start` (or `copy`) must always be paired with an `end`.
