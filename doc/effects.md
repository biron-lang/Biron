# Effects &amp; Hermeticity

An *effect* is a capability a function needs in order to do its work, the ability to log, to talk to the outside world, to observe a memory ordering. In Biron a function must declare the effects it uses, and those effects must be established by a caller before the function can be called. This turns "what can this code touch?" from a question answered by reading a whole call tree into one answered by reading a single line.

## Declaring an effect

An effect is declared in angle brackets, after the parameter list and before the return type.

```biron
fn work() <IO> -> Sint32 { /* ... */ }
```

An effect is a **named** (nominal) type. It is introduced with `type`, and it is matched by its name alone. Two effects with identical underlying structure but different names are different effects. The underlying type can be anything from a plain integer to a struct.

```biron
type Log = Sint32

fn emit() <Log> -> Sint32 {
	return Log!;
}
```

Calling a function that declares an effect not established in the current scope is a type error. That is the whole enforcement mechanism. `emit` cannot be called unless `Log` is in scope.

## Establishing an effect with `with`

A `with` statement establishes an effect for a dynamic extent, making it available to everything called from that point onward.

```biron
fn direct() -> Sint32 {
	with Log = 7;
	return emit();      // 7
}
```

The value on the right of `=` is the *handler*, the concrete value callees will see. Once established, any callee that declares `<Log>` may run.

## Reading a handler with `E!`

Inside a function that declares an effect, the postfix `!` reads the established handler value. `Log!` is the handler itself. If the handler is a struct, its fields are accessed with `E!.field`.

```biron
type Cfg = struct { lo: Sint32, hi: Sint32 }

fn span() <Cfg> -> Sint32 {
	return Cfg!.hi - Cfg!.lo;
}
```

## Propagation

A function that itself declares an effect may call another function needing the same effect, without re-establishing it. The effect flows through.

```biron
// `doubled` has the Log effect, so it may call `emit`, which needs it.
fn doubled() <Log> -> Sint32 {
	return emit() + emit();
}

fn run() -> Sint32 {
	with Log = 21;
	return doubled();   // 21 + 21 = 42
}
```

An effect is also part of a function value. The `Log` effect is included in the type `fn() <Log> -> Sint32`, so an indirect call through such a value needs `Log` in scope exactly like a direct call.

## Lexical scope and shadowing

A `with` establishes its effect for the rest of the enclosing block. A nested `with` on the same effect shadows the outer one for the extent of the inner block, and the outer value is restored on the way out.

```biron
fn shadow() -> Sint32 {
	with Log = 1;
	{
		with Log = 9;
		return emit();  // inner handler wins -> 9
	}
}
```

## Hermeticity

Hermeticity is a property of functions in Biron. Hermetic code can only modify local state, including its arguments. Such functions cannot modify global state, including thread-related state like mutexes, and cannot make actual or virtual system calls, including allocating memory or querying timers, without a capability indicating so. That capability is given by an effect. Hermeticity is similar to [purity](https://en.wikipedia.org/wiki/Pure_function).

Because every side-effecting capability must be declared and then established through an effect, **all Biron code is hermetic by default.** A function with no effects cannot log, cannot perform IO, cannot observe anything ambient. It can only compute over its arguments. Anything non-hermetic has to flow through an effect.

The payoff is control. An entire program can be sandboxed, introspected, or intercepted from a single place, the one `with` that establishes an effect. Swapping the handler makes every callee see the new behavior, with nothing else to change and nowhere for a hidden dependency to leak in.

## No global mutable state

Biron has no global variables. A mutable value visible to every function would be exactly the ambient, undeclared capability the effect system exists to rule out. It could be read or written from anywhere without being named in a signature, and hermeticity would be lost.

Read-only globals are a different matter. A file-scope `const` denotes a compile-time value with a stable address (see [Constants & Attributes](#attributes)). Reading a constant is not a side effect, so nothing is compromised, and constants are available freely everywhere.

State that genuinely must be shared and mutated is passed explicitly instead, by reference or as an ordinary effect, so that it stays visible in the signatures that use it.

> [!RATIONALE]
> Mutable global state could in principle be modeled as an effect, an imagined `<Global>` capability threaded through every function that touches it. Such an effect could never be made hermetic. Its whole purpose would be to be available from anywhere, which is the opposite of a capability granted in one place and passed inward. Because that cannot be reconciled with the guarantee, global mutable state is absent from the language.

## Const effects

An effect prefixed with `const` becomes a compile-time value.

```biron
type Order = Sint32

fn addn(x: Sint32) <const Order> -> Sint32 {
	return x + Order!;
}
```

The `with` value for a `const` effect must be a constant expression, and it is folded directly into each callee rather than passed at runtime. A function with a `const` effect is specialized per distinct value, so two different `with` values produce two independent instances.

```biron
fn spread() -> Sint32 {
	with Order = 10;
	let lo = addn(5);       // 15
	with Order = 100;
	let hi = addn(5);       // 105
	return hi - lo;         // 90
}
```

`Order!` inside the body reads that folded constant. Const effects propagate and shadow just like runtime effects, and a const struct handler allows a field to be read where a constant is required (`Cfg!.hi`). Runtime and const effects can mix freely in one list.

```biron
fn tally(x: Sint32) <Log, const Order> -> Sint32 {
	return x + Log! + Order!;   // Log at runtime, Order folded in
}
```

> [!NOTE]
> A `const` effect cannot be placed on a method.

## Atomics and MemoryOrder

An atomic value `@T` gets its memory ordering from a `MemoryOrder` effect established in scope. `MemoryOrder` is a builtin enum with the members `.Relaxed`, `.Consume`, `.Acquire`, `.Release`, `.AcqRel`, and `.SeqCst`. It is established like any other effect.

```biron
let a: @Sint32 = 0;
with MemoryOrder = .SeqCst;

a = 10;                // atomic store
a += 5;                // atomic read-modify-write
let x = a + a;         // each read is an atomic load
```

Every access to an `@T` is atomic, and an access with no `MemoryOrder` established is an error. Because `MemoryOrder` is an ordinary effect, a function operating on an atomic can declare `<const MemoryOrder>` and inherit the caller's chosen order.

```biron
fn bump(x: &@Sint32) <const MemoryOrder> {
	x += 1;
}
```

A nested block can establish a different order for its own extent, exactly as with any effect.

## Effects over a generic parameter

An effect is a named type, so a generic type parameter can *be* the effect. `fn[T: Type] f(x: T) <T>` declares an effect whose type is `T`.

```biron
type Effect = struct { x: Sint32 }

fn[T: Type] via_runtime(x: T) <T> -> Sint32 {
	return T!.x;
}

fn caller() -> Sint32 {
	with Effect = Effect { .x = 42 };
	return via_runtime(Effect { .x = 7 });   // reads the effect -> 42
}
```

When the function is instantiated, `<T>` becomes `<Effect>` and `T!` becomes `Effect!`. The binding can come by inference or by an explicit turbofish (`via_runtime::[Effect](arg)`), and it works for both runtime and `const` effects.

> [!IMPORTANT]
> The type bound to `T` must be a named type.

## The `Caller` effect

`Caller` is provided by the compiler rather than established with `with`. It is a struct describing the call site.

```biron
struct Caller {
	address:    Address,   // the caller function's entry address
	expression: String,    // the call, stringized from its source
	file:       String,    // the source file the call is in
	line:       Uint32,    // the source line of the call
	column:     Uint16,    // the source column of the call
}
```

A function requires it the way it requires any effect, and reads it with `Caller!` (a field as `Caller!.line`). What differs is establishment. A caller never writes `with Caller = ...`. Because the compiler provides it, a call to a function that requires `Caller` is always allowed, and the compiler synthesizes the frame at the call. Every field is a compile-time constant, so the frame is one `static const` value whose address is handed over.

```biron
fn assert(x: Bool) <Caller> {
	if x { return; }
	let c = Caller!;
	// c.file, c.line, c.column, and c.expression point at the failing call
}

fn main() -> Sint32 {
	assert(1 + 1 == 2);                // no `with` needed
	return 0;
}
```

A function that itself declares `Caller` forwards its own frame to a nested call, so the frame names the original call site rather than the intermediate one, the way a caller-location attribute works in other languages. A caller may still override the frame with `with Caller = ...`, and `drop Caller` reverts later calls to fresh synthesis.
