# Generics

Biron supports functions and composite types that are parameterized over types and over compile-time values. A generic declaration is a template. Its parameters are named in a `[...]` list, used in the body, and Biron produces a concrete function or type for each distinct set of arguments supplied.

## Generic parameters

A generic parameter is written `name: kind`, and its *kind* decides what sort of parameter it is.

- A **type generic** has the kind `Type`, as in `T: Type`. It stands for a type.
- A **value generic** has a numeric kind, such as `N: Uint32`. It stands for a compile-time constant of that type.

`Type` is the type of types, and it is only ever legal as the kind of a generic parameter. Everything else is an ordinary type, so the parameter behaves like a constant of it.

Parameters are read left to right, and a later parameter may name an earlier type generic as its own kind.

```biron
fn[T: Type, V: T] valof() -> T {
	return V;
}
```

Here `T` is a type generic and `V` is a value generic whose type is whatever `T` was bound to.

## Generic functions

Prefixing the parameter list to a function's name makes it generic. A type generic lets the same body work for any type.

```biron
fn[T: Type] id(x: T) -> T {
	return x;
}
```

A value generic threads a compile-time constant into the body, where it reads like a named constant.

```biron
fn[N: Uint32] add_n(x: Uint32) -> Uint32 {
	return x + N;
}
```

Type and value generics may be mixed and matched. This function is generic in two types and two values.

```biron
fn[T: Type, U: Type, a: T, b: U] pairsum() -> Sint32 {
	return (a as Sint32) + (b as Sint32);
}
```

## Inference and the turbofish

There are two ways to supply generic arguments.

**Inference.** When the bindings can be recovered from the call's argument types, nothing extra is written and Biron figures them out. A call to `id` infers `T` from the value passed.

```biron
fn doubled(n: Sint32) -> Sint32 {
	return id(n) + id(n);      // id with T = Sint32, inferred
}
```

**The turbofish.** When the arguments are to be named explicitly, or when they cannot be inferred (a value generic that never appears in a parameter, for example), they are attached with `::[...]`.

```biron
id::[Sint32](9)               // T given explicitly
valof::[Uint32, 7]()          // T = Uint32, V = 7
```

A value generic argument may be any constant *expression*, folded at compile time.

```biron
fn bump(x: Uint32) -> Uint32 {
	return add_n::[(3 * 4) / 2](x);   // N = 6
}
```

### Value generics can be any constant

A value generic is not limited to integers. Its argument can be any constant of its kind, including a whole struct value, passed either as a named `const` or as a literal written inline.

```biron
type Vec = struct { x: Sint32, y: Sint32 }
const ORIGIN = Vec { .x = 3, .y = 4 };

fn[V: Vec] vsum() -> Sint32 {
	return V.x + V.y;
}

vsum::[ORIGIN]()                 // reads 3 + 4
vsum::[Vec{ .x = 10, .y = 1 }]() // reads 10 + 1
```

Floating-point and other scalar constants work the same way, so `pairsum::[Real32, Uint32, 10.0, 10]()` binds two types and two values at once.

## Generic composite types

A `struct`, `union`, or `enum` can have a generic parameter list, introduced through a `type` declaration.

```biron
type Box    = struct[T: Type] { value: T }
type Pair   = struct[A: Type, B: Type] { first: A, second: B }
type Either = union[A: Type, B: Type] { A, B }
```

A generic type is instantiated with the same turbofish spelling, `Name::[args]`, and the result may be used anywhere a type is expected.

```biron
fn take_pair(p: Pair::[Sint32, Bool]) -> Sint32 { return 3; }
```

An instantiation can be constructed like any other aggregate, by following it with a literal.

```biron
let b = Box::[Sint32] { .value = 42 };
```

Types imported from a module are instantiated the same way, qualifying the name first.

```biron
let r = mathmod::Rational::[Real32] { .num = 22.0, .den = 7.0 };
```

## Instantiation identity

Each distinct set of arguments produces its own concrete entity. `id::[Sint32]` and `id::[Uint32]` are two separate functions, and `Pair::[Sint32, Bool]` and `Pair::[Bool, Sint32]` are two separate types.

The flip side matters just as much, and **identical instantiations are the same entity.** If two places both name `Box::[Sint32]`, they refer to one and the same type, so a value of one is a value of the other.

```biron
fn take_box(b: Box::[Sint32]) -> Sint32       { return 1; }
fn take_box_again(b: Box::[Sint32]) -> Sint32 { return 2; }  // same type
```

> [!NOTE]
> A generic body is type-checked once, with type generics treated as abstract types and value generics as constants, so an error in the template is reported in the template rather than at every use.

## Generic methods

Methods can be generic too. The parameter list precedes the receiver, and the type argument is usually recovered from the receiver's own type.

```biron
type Box = struct[T: Type] { value: T }
fn[T: Type](self: &Box::[T]) get() -> T { return self.value; }
```

When the parameter cannot be inferred from the receiver or the arguments, it is given with a turbofish on the call itself.

```biron
fn[T: Type](x: Sint32) widen() -> T { return x as T; }

let a = 7.widen::[Sint64]();
```

See [Methods](#functions) for the receiver syntax and call rules.

## Generic parameters as effects

Because an effect is just a named type, a type generic can be used as one. The parameter appears in the effect list and is read with the `T!` form.

```biron
fn[T: Type] via_runtime(x: T) <T> -> Sint32 {
	return T!.x;
}
```

At each instantiation the effect follows the same substitution as every other use of `T`, so establishing `with Effect = ...;` and binding `T = Effect` turns `<T>` into `<Effect>`. This works for both runtime and `const` effects. See [Effects](#effects) for the full effect model.
