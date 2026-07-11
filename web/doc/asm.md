# Inline Assembly

A small piece of machine code can be written directly inside a Biron program with
inline assembly. It is used where a specific instruction is needed and no ordinary
expression will serve, for example a system call, an atomic operation, or a processor
feature query. Two forms are provided. The expression form produces a callable value
from an instruction and its operands. The naked form is used when the body of a whole
function is written by hand.

Inline assembly is not available yet. This chapter describes the feature as it is
designed.

## An assembly block

An assembly block is written with `asm`, a template string, and a list of operands.
A function value is produced by the block, so it may be stored in a binding and
called, or it may be called at once.

```biron
let add = asm("add %1, %0") {
	asm::Reg { .Any, .Inout },   // operand 0
	asm::Reg { .Any, .In },      // operand 1
	asm::Clobber { "cc" },
};
let sum = add(x, y);             // or asm("add %1, %0"){ ... }(x, y)
```

Each operand is described by a value from the `asm` module. A register is written
`asm::Reg`, a piece of memory `asm::Mem`, and a constant `asm::Imm`. The register, or
`Any` for a register left to the compiler, is given first, and the direction second.

Each operand is referred to inside the template by its position. The first operand is
`%0`, the second `%1`, and so on. An operand appears in the template only when the
instruction uses it. The `add` instruction uses two, while `syscall` uses none,
because a system call is passed its arguments in fixed registers.

## Inputs and outputs

The direction of a register operand decides how it is seen at the call. An input is
passed in, an output is returned, and an in-out operand is both. The call arguments
are the inputs and the in-out operands. The result is the outputs and the in-out
operands. A single output is returned as a plain value, and several are returned as a
tuple read with `.0` and `.1`.

```biron
let cpuid = asm("cpuid") {
	asm::Reg { .Rax, .Inout },   // leaf in, result out
	asm::Reg { .Rbx, .Out },
	asm::Reg { .Rcx, .Inout },   // subleaf in, result out
	asm::Reg { .Rdx, .Out },
};
let r = cpuid(leaf, 0);          // r.0, r.1, r.2, r.3
```

The width of a register is taken from the value. A `Uint32` is placed in a 32 bit
register and a `Uint64` in a 64 bit register, so no width is written by hand.

## Memory operands

A memory operand is passed a pointer, and the instruction reads or writes that memory
in place. A memory operand is never part of the result, so a change is observed
through the same pointer afterward.

```biron
let fetch_add = asm("lock xadd %0, %1") {
	asm::Reg { .Any, .Inout },   // added in, old value out
	asm::Mem { .Inout },         // updated in place
	asm::Clobber { "cc" },
};
let old = fetch_add(delta, &counter);   // old value returned, counter holds the sum
```

## Immediate values

An immediate operand holds a constant that is known at compile time. It is always an
input, and a write direction on one is rejected.

```biron
asm::Imm { 42 },
```

## Clobbers

A clobber records something the instruction destroys that is not one of the operands.
A register name such as `"rcx"` is given, along with `"memory"` for memory the
instruction touches and `"cc"` for the condition flags. Anything left undeclared may
be miscompiled, so every destroyed register and flag is listed.

## Naked functions

When an `asm` block is written in place of a function body, the function is naked. No
entry or exit code is added, and the body is the whole function. The arguments arrive
in the registers of the calling convention, and the return value is left in the
register the convention expects, so those registers are used directly. A naked
function is written with no operand list.

The parameters of a naked function are written as types alone, with no names, because
a name could not be used inside the assembly. The return type still matters. A value
type requires the result to be left in the return register, and the never type `!`
marks a function that does not return.

## setjmp and longjmp

`setjmp` and `longjmp` are written as naked functions. The registers that must be
preserved are saved by `setjmp`, which then returns zero. Those registers are restored
by `longjmp`, which resumes at the saved point and does not return. `setjmp` is marked
`@(returns_twice)`, because control returns to its caller once directly and again
through `longjmp`.

```biron
type JmpBuf = struct { /* the saved registers */ }

@(returns_twice)
fn setjmp(*JmpBuf) -> Sint32 asm("...")      // saves registers, returns 0

fn longjmp(*JmpBuf, Sint32) -> ! asm("...")  // restores registers, never returns
```

```biron
let env: JmpBuf;
if setjmp(&env) == 0 {
	work(&env);          // longjmp(&env, 1) is called somewhere below
} else {
	recover();           // control resumes here after longjmp
}
```

## Safety

Inline assembly can break the guarantees the rest of the language keeps, so the
`unsafe` keyword is planned to be required for it. No effect is required.
