# Inline Assembly

Inline assembly is offered as a statement in most languages. Biron takes a different approach and offers it as a type. A few unusual properties follow from that choice. The inputs, outputs, and clobbers of a block are supplied as an aggregate initializer for any variable declared of the asm type. A block is built from constant expressions and is even passed as a constant value through generics, so inline assembly is given the same templating the rest of the language already offers, in a cohesive and familiar syntax. A form of type checking becomes possible that rules out common mistakes, and the whole construct looks and behaves consistently, in both its syntax and its semantics.

## The assembly type

`asm("template")` is a type. The template is the assembler text, and a value of the type is built by an ordinary aggregate initializer whose elements are the operands. The value is a constant, so it is bound with `const`, and it composes from other constants and passes through generics the way any constant does.

As an example, an integer add of two registers is written as three operands. The block is an inline literal, and its type is inferred the way any `T { ... }` literal is.

```biron
const add = asm("add %1, %0") {
	asm::Reg { .Any, .Inout },   // operand 0
	asm::Reg { .Any, .In },      // operand 1
	asm::Clobber { "cc" },
};
```

Since it is a type like any other, it can also be written as an explicit type on the named binding, or through a named type too.

```biron
const add2: asm("add %1, %0") = {
	asm::Reg { .Any, .Inout },
	asm::Reg { .Any, .In },
	asm::Clobber { "cc" }
};

type Add = asm("add %1, %0");
const add3 = Add {
	asm::Reg { .Any, .Inout },
	asm::Reg { .Any, .In },
	asm::Clobber { "cc" }
};
```

## Running a block

A value of the asm type is executed by being called. Building the value is safe, because it is only constant data, so a call is the unsafe part and is permitted only inside an `unsafe` block. The result of the call is the block's outputs.

```biron
let sum = unsafe { add(x, y) };
```

The arguments are matched to the input operands by position, so `x` is the first input and `y` the second. A single output is returned as a plain value, and several are returned as a tuple read with `.0` and `.1`.

## Operands

Each element of the aggregate is one operand, described by a value from the `asm` module.

> [!NOTE]
> These types are a convenience which structurally matches the requirement for an `asm` type. There is nothing special about them and they are not a special "compiler builtin".

| Type           | Used for           |
|----------------|--------------------|
| `asm::Reg`     | A register         |
| `asm::Mem`     | A piece of memory  |
| `asm::Imm`     | An immediate value |
| `asm::Clobber` | Clobber            |

> [!NOTE]
> A register uses an implicit selector of its name, or `.Any` to leave the allocation to the compiler, and it also takes a direction (`.In`, `.Out`, or `.Inout`).

Each operand is referred to inside the template by its position. The first is `%0`, the second `%1`, and so on. An operand appears in the template only when the instruction uses it. For example, the `add` instruction uses two, while `syscall` uses none, because a system call is passed its arguments in fixed registers.

## Inputs and outputs

The direction of a register operand decides how it is seen at the call. An input is passed in, an output is returned in the result, and an in-out operand is both. So the call arguments are the inputs and the in-out operands, and the result is the outputs and the in-out operands.

For example, CPUID reads four result registers from a leaf and a subleaf.

```biron
const cpuid = asm("cpuid") {
	asm::Reg { .Rax, .Inout },   // leaf in, result out
	asm::Reg { .Rbx, .Out },
	asm::Reg { .Rcx, .Inout },   // subleaf in, result out
	asm::Reg { .Rdx, .Out },
};
let r = unsafe { cpuid(leaf, 0) };   // r.0, r.1, r.2, r.3
```

The width of a register is taken from the value, so a `Uint32` is placed in a 32 bit register and a `Uint64` in a 64 bit register. No width is written by hand.

## Memory operands

A memory operand is passed a pointer, and the instruction reads or writes that memory in place. A memory operand is never part of the result, so a change is observed through the same pointer afterward.

For example, an atomic fetch and add returns the old value and leaves the sum in memory.

```biron
const fetch_add = asm("lock xadd %0, %1") {
	asm::Reg { .Any, .Inout },   // added in, old value out
	asm::Mem { .Inout },         // updated in place
	asm::Clobber { "cc" },
};
let old = unsafe { fetch_add(delta, &counter) };   // old value returned, counter holds the sum
```

## Immediate values

An immediate operand holds a constant that is known at compile time. It is always an input, and a write direction on one is rejected.

```biron
asm::Imm { 42 as! Uint32 },
```

## Clobbers

A clobber records one location the instruction destroys that is not an operand. Each is its own entry, a register name such as `"rcx"`, or `"memory"` for memory the instruction touches, or `"cc"` for the condition flags.

> [!CAUTION]
> Anything left undeclared may be miscompiled, so every destroyed register and flag must be listed as a clobber.

A block with an empty template and only a `"memory"` clobber is a compiler memory barrier. It emits no instruction, and it orders the surrounding loads and stores so that none are moved across it.

```biron
unsafe { asm("") { asm::Clobber { "memory" } }(); }
```

> [!NOTE]
> Since an asm value is a type like any other, it can also be invoked immediately, as in the example above.

## Composition

Because a block is a value of an ordinary type, it composes the way other values do. The operand list is built from constant expressions and shared constants, so it is possible to factor out and reuse a common sequence. An asm type is also a generic argument like any other, so one routine can be written over an unknown block and specialized for each one. This is the same templating the rest of the language already has.

## Type checking

Because the operands are typed and the template is checked against them, a class of common mistakes is caught before the program runs. A write direction on an immediate is rejected, a missing operand is reported, and the width of each register follows from its value rather than being repeated by hand.

An `.Any` register has no fixed name, so it is referenced only by a `%N` placeholder in the template. Each `.Any` register must have a placeholder, and each placeholder must correspond to an operand, so the number of `.Any` registers matches the number of placeholders. A pinned register is referenced by its own name in the template instead, and needs no placeholder.

## Examples

The two examples below on x86-64 use more of the operand model, together with the CPUID block above.

A 128 bit compare and exchange with `CMPXCHG16B`. The expected value is held in the rdx and rax pair and the desired value in the rcx and rbx pair, the address is in rsi, and the zero flag reports whether the exchange happened.

```biron
const cas16 = asm("lock cmpxchg16b (%rsi); setz %r8b") {
	asm::Reg { .Rax, .Inout },   // expected low in, old low out
	asm::Reg { .Rdx, .Inout },   // expected high in, old high out
	asm::Reg { .Rbx, .In },      // desired low
	asm::Reg { .Rcx, .In },      // desired high
	asm::Reg { .Rsi, .In },      // pointer to the 16 byte aligned value
	asm::Reg { .R8,  .Out },     // 1 on success, 0 on failure
	asm::Clobber { "memory" },
	asm::Clobber { "cc" },
};
let result = unsafe { cas16(exp_lo, exp_hi, new_lo, new_hi, addr) };
// result.0 = old_lo
// result.1 = old_hi
// result.2 = ok
```

## Naked functions

When an asm block is written in place of a function body, the function is naked. No entry or exit code is added, and the body is the whole function. The arguments arrive in the registers of the calling convention, and the return value is left in the register the convention expects, so those registers are used directly. A naked function is written with no operand list.

```biron
fn foo(Args) -> Rets asm("
	// instructions
");
```

The parameters of a naked function are written as types alone, with no names, because a name could not be used inside the assembly. The return type still matters. A value type requires the result to be left in the return register, and the never type `!` marks a function that does not return.

A naked function cannot have a receiver and cannot be generic. In every other respect it is an ordinary function. It can take attributes and be an associated function. A call on it needs an `unsafe` block, the same as a call on an asm value.

## Safety

Building an asm value is safe, because it is only constant data. Running it can break the guarantees the rest of the language keeps, so a call on an asm value is permitted only inside an `unsafe` block.
