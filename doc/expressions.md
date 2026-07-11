# Expressions

An expression computes a value. Biron builds larger expressions out of smaller ones with the usual operators. These are arithmetic, comparison, logical, bitwise, plus a few Biron additions such as saturating min/max, a checked division that cannot trap on a zero divisor, and the type-testing `is` operator. This chapter walks through every operator, its precedence, and how the pieces fit together.

## Precedence and associativity

The table below lists the binary operators from loosest to tightest. A tighter operator binds to its operands first, so `1 + 2 * 3` is `1 + (2 * 3)`.

| Level | Operators | Meaning |
|-------|-----------|---------|
| 1 (loosest) | `\|\|` | logical or |
| 2 | `&&` | logical and |
| 3 | `\|` | bitwise or |
| 4 | `^` | bitwise xor |
| 5 | `&` | bitwise and |
| 6 | `==` `!=` | equality |
| 7 | `<` `<=` `>` `>=` | ordering |
| 8 | `of` `<?` `>?` `as` `is` | property, min, max, cast, type test |
| 9 | `<<` `>>` | bit shifts |
| 10 | `+` `-` | add, subtract |
| 11 (tightest) | `*` `/` `%` | multiply, divide, remainder |

Every binary operator is **left associative**, so `a - b - c` is `(a - b) - c`.

Prefix and postfix operators bind tighter than every binary operator, and the postfix operators bind tightest of all. Postfix operators apply left to right.

| Position | Operators | Meaning |
|----------|-----------|---------|
| Postfix (tightest) | `f(args)`, `a[i]`, `a[lo:hi]`, `x.field`, `x!`, `x::[T]` | call, index, slice, member or tuple access, force, generic instantiation |
| Prefix | `-`, `!`, `~`, `*`, `&` | negate, logical or bitwise not, explode, dereference, address-of |

Parentheses `( ... )` group a sub-expression and override all of this, and `[ ... ]` after a value is always an index or a slice, never grouping. Both `*` and `&` do double duty. Each is a binary operator (`a * b` multiplies, `a & b` is a bitwise and) and, in prefix position, a unary operator (`*p` dereferences, `&x` takes an address). The position decides which.

> [!IMPORTANT]
> Two precedences differ from C and are worth remembering. The shifts `<<` `>>` (level 9) bind *tighter* than `+` `-`, so `a + b << c` means `a + (b << c)`. And the bitwise `&` `|` `^` bind looser than the comparisons, so they must be parenthesized when mixed. Write `(a & mask) == 0`, not `a & mask == 0`.

The ternary `c ? a : b` is looser than every binary operator and is **right associative**, so `a ? b : c ? d : e` groups as `a ? b : (c ? d : e)`.

## Arithmetic

The arithmetic operators `+` `-` `*` `/` `%` work on the integer and floating-point types. The prefix `-` negates. Integer literals stay untyped until context fixes them, so both operands of `10 + 20` take the same type as their peer.

```biron
fn sum3(a: Sint32, b: Sint32, c: Sint32) -> Sint32 { return a + b + c; }
```

Integer `/` and `%` are *checked* against a zero divisor. See [Checked division](#expressions/checked-division) below. Floating-point `/` and `%` are unchecked.

## Comparison

The six comparison operators `==` `!=` `<` `<=` `>` `>=` compare two values of the same type and yield a `Bool`.

```biron
if got == want { return 0; }
```

## Logical and not

`&&` and `||` combine `Bool` values into a `Bool`. The prefix `!` is Rust-style. It is **logical not on a `Bool`**, but **bitwise not on an integer**.

```biron
let stop = done && ready;   // Bool and Bool
let flip = !ready;          // Bool -> Bool
let mask = !bits;           // integer -> integer (bitwise complement)
```

## Bitwise

The bitwise operators `&` `|` `^` operate on integers, and `<<` `>>` shift an integer left or right.

```biron
let both = a & b;
let any  = a | b;
let diff = a ^ b;
let up   = a << 5;
let down = a >> 5;
```

## Minimum and maximum

`a <? b` is the minimum of the two operands and `a >? b` is the maximum. Both sit at level 8 and, like every binary operator, chain left to right, so `lo >? x <? hi` clamps `x` into `[lo, hi]`. Each operand is evaluated exactly once, which is the whole point of having them.

```biron
fn clamp(x: Sint32, lo: Sint32, hi: Sint32) -> Sint32 {
    return lo >? x <? hi;
}
```

So `3 <? 7` is `3` and `3 >? 7` is `7`.

## Casts and type tests

`a as T` is an explicit cast. It converts between numeric types, recovers a typed pointer from `Address`, and crosses an enum with its underlying integer. Since integer and float literals are untyped, a cast is also how a literal is pinned to a specific type.

```biron
let n = 10 as Uint64;
let f = 3.5 as Real32;
let i = (f * 2.0 as Real32) as Sint32;
```

`a is T` is a type test that yields a `Bool`. It is most useful on a `union` value, where it checks the stored variant. Used as a condition, it also narrows the value to `&T` (a reference into its storage) inside the branch.

```biron
fn kind(x: Variant) -> Sint32 {
    if x is String { return 0; }
    if x is Bool   { return 1; }
    if x is Sint32 { return 2; }
    return -1;
}
```

> [!NOTE]
> The `of` operator also lives at level 8. It takes a property from a type or an
> expression, and it has its own chapter. See **Properties**.

## The force operator

A postfix `!` is the force operator, an assertion. It keeps the operand's type unchanged, so it is **not** an optional unwrap.

```biron
let y = x!;   // same type as x
```

## Checked division

For integer operands, `a / b` and `a % b` yield `?T` rather than `T`. The result is `none` when the divisor is zero, so a division by zero can never trap. The quotient is obtained by testing the optional, which narrows it to the value.

```biron
fn divide(a: Sint32, b: Sint32) -> Sint32 {
    let q = a / b;         // q is ?Sint32
    if q { return q; }     // present: q is the Sint32
    return -1;             // divisor was zero
}
```

When the divisor is known to be non-zero and a plain `T` is wanted, `@(unsafe_div)` can be attached to a function, statement, or block. Inside it, `/` and `%` skip the check and yield `T` directly, and the compound forms `/=` and `%=` become available (they are rejected everywhere else, since a `?T` result could not assign back into a `T`).

```biron
@(unsafe_div)
fn fastdiv(a: Sint32, b: Sint32) -> Sint32 {
    return a / b;          // plain Sint32
}

fn compound() -> Sint32 {
    let n = 100;
    @(unsafe_div) {
        n /= 3;            // 33
        n %= 10;           // 3
    }
    return n;
}
```

Floating-point `/` and `%` are always unchecked and yield `T`.

## Array programming

When the element type of an array, after peeling away every array layer, is an integer or a real, the arithmetic operators apply to whole arrays component by component. Two arrays of the same type combine element with matching element, and this extends through nesting, so `[2]Real32 + [2]Real32` and `[2][2]Real32 + [2][2]Real32` are both element-wise.

```biron
let a = [4]Sint32 { 1, 2, 3, 4 };
let b = [4]Sint32 { 10, 20, 30, 40 };
let c = a + b;                 // [4]Sint32 { 11, 22, 33, 44 }
```

A scalar on either side is replicated into every element, so an array pairs with a single value of its element type.

```biron
let d = a * 2;                 // [4]Sint32 { 2, 4, 6, 8 }
let e = 2 * a;                 // the scalar may sit on either side
```

The scalar special cases hold per element. For an integer element type, `/` and `%` produce an optional exactly as scalar checked division does, so `[2]Uint32 / Uint32` and `[2]Uint32 / [2]Uint32` both yield `?[2]Uint32`, `none` when any divisor element is zero, unless the divide sits in an `@(unsafe_div)` scope. The bitshift operators are likewise available for integer element types.

Equality compares component by component and reduces to a single `Bool`, true only when every element matches. `==` and `!=` are the only comparisons permitted.

> [!CAUTION]
> The relational operators `<`, `<=`, `>`, and `>=` are rejected on arrays, since no single ordering is meaningful.

## The ternary operator

`c ? a : b` evaluates the condition `c`, then evaluates and returns *only the taken branch*. The two branches must agree on a type.

```biron
fn safe_div(a: Sint32, b: Sint32) -> Sint32 {
    let q = a / b;
    return q ? q : -1;     // q narrows to its value in the true branch
}
```

Because the ternary is right associative, an `else if` ladder reads naturally.

```biron
// a ? 1 : (b ? 2 : 3)
let r = a > 100 ? 1 : b > 100 ? 2 : 3;
```

## Explode

The prefix `~x` is the explode (or spread) operator. It splices the elements of a tuple, struct, or fixed array into a comma-separated list, so one aggregate can fill several positions at once.

```biron
let t = (1, 2, 3);
let s = sum3(~t);          // same as sum3(t.0, t.1, t.2)
```

Explode works in call arguments, aggregate literals, and method receivers. See the [Aggregates](#aggregates) chapter for the full story.
