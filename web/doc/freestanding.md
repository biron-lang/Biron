# Freestanding Executables

A Biron program compiles to a static executable that links no libraries. Despite this, it can stil use the system's dynamic linker at runtime to load dynamic libraries, something an ordinary static executable cannot typically do.

The way this works is platform independent. A hosted operating system always has a dynamic linker, since it relies on one to start ordinary programs and to load their libraries. The Biron runtime captures that linker and exposes it as a capability, so that programs written in Biron can use dynamic libraries later without having linked against a runtime at build time. The Biron runtime captures the linker by a different route for each platform.

## How a Biron program works

A Biron program is completely freestanding. Nothing is assumed about the environment beyond what the operating system hands any fresh process. Access to the outside world is a capability requested through an effect and specified in the signature. The dynamic linker is one such capability. A `main` that requests the `System` effect obtains it together with the filesystem.

```biron
fn main() <System> -> Sint32 {
	// the dynamic linker and filesystem are available here, specifically through:
	// 	System!.loader
	// 	System!.filesystem
	return 0;
}
```

The dynamic linker is exposed as a `loader` interface with `open`, `link`, and `close` functions. It is present when the platform has a dynamic linker to capture, and none when it does not. A dynamic library is **always** resolved through this captured loader at runtime and never at build time. Static libraries are linked in at build time. The loader effect is covered in [Effects & Hermeticity](#effects), and the declaration of a foreign library in [Modules & Foreign](#modules).

## Static linking isn't enough

A statically linked executable contains the code of every library it depends on, so it is a single self-contained file, portable across machines and distributions (barring architectual differences). On some platforms, such as Linux and macOS, this comes at the price of the dynamic linker though as a statically linked libc typically precludes a working dynamic linker in the same process. Where that happens, `dlopen` and `dlsym` do not function, and things that depend on them are unavailable.

On Linux, for example, that removes access to a wide range of system components.

- GPU drivers such as the OpenGL and Vulkan
- Window systems such as X11 and Wayland
- Audio and input subsystems
- PAM modules and NSS services
- Almost any plugin-based runtime

A fully static program written in any other language would give these up, but a Biron executable does not.

## The Linux implementation

Linux exposes no interface to the dynamic linker from a static process, so the Biron runtime obtains one indirectly, through a mechanism called a detour.[^detour] The detour reuses the exact path the kernel takes to start a dynamic program.

When a dynamic ELF binary is run, the kernel does not execute it directly. It reads the program header table, finds the `PT_INTERP` segment that specifies an interpreter such as `/lib64/ld-linux-x86-64.so.2`, and executes that interpreter, passing it the executable path, the arguments, the environment, and the auxiliary vector. The interpreter, which is the dynamic linker, maps the executable, resolves its shared libraries, performs relocations, sets up thread-local storage, runs constructors, and finally transfers control to the program's entry point. At that entry point the linker is fully initialized and safe to use, and that is the moment the detour aims for.

The Biron runtime embeds a second, real program for this purpose. It is a tiny stub that is genuinely dynamically linked against the system dynamic linker, held inside the executable and written to an anonymous in-memory file at startup. A minimal ELF loader in the runtime then plays the part of the kernel.

1. It maps the stub, reads the stub's `PT_INTERP`, and maps the dynamic linker the stub asks for.
2. It records a resume point in the current call, then builds the initial stack and auxiliary vector that describe the stub and its interpreter, arranged the way the kernel would arrange them.
3. It transfers control into the dynamic linker as though the kernel had started the stub.
4. The dynamic linker on the host system initializes the stub completely and calls the stub's entry point. There the linker's own functions are captured and handed to a callback which performs a non-local goto back to the resume point recorded in step 2.

Control returns to the Biron runtime, to the point in its startup where the detour began, with those captured functions. Those functions become the loader that the `System` effect exposes. The stub is run only once, at startup, and the linker it sets up stays available for the life of the process.

No libc is linked at build time. It is obtained at Biron initialization instead, through the dynamic linker the detour captures, so the program binds to whatever libc the target system provides rather than to a version fixed when it was built, which makes a libc version conflict impossible.

Two details keep the detour safe and portable. The resume state is threaded through the calling frame rather than held in a global, in keeping with Biron's hermeticity, since a plain function cannot close over it. The stub also pins the symbols it uses to the earliest glibc that shipped the dynamic linker, around 2002, so the result runs on essentially any Linux install since 2002. These symbols are also present in alternative libc implementations, making Biron executables work with glibc, musl, and bionic.

## The Windows implementation

Windows is is a much simpler implementation which doesn't require a detour, because a Windows process already holds its loader in a structure the program can read directly.[^winimports]

When Windows starts a process it sets up per-thread and per-process structures found through the GS segment register. The per-thread one, called the Thread Environment Block (TEB) sits at GS offset `0x30` and points at the per-process one, called the Process Environment Block (PEB). The PEB holds information about the loader, including a doubly-linked list of the loaded modules which Windows calls DLLs. The list is actually held in the order they were mapped, which is convenient as one of the earliest mapped modules is `kernel32.dll`. The Biron runtime walks this in-memory-order list and finds that `kernel32.dll`, which is always mapped into every Win32 and Win64 process. From the `kernel32.dll` module base it reads the DOS header and follows it to the PE header and finally the the Export Directory where it can lookup the following procedures
- `LoadLibraryA`
- `FreeLibrary`
- `GetProcAddress`

These procedures are the basis of the loader itself and play the same role as `dlopen`, `dlsym`, and `dlclose` do on Linux. With them, any WinAPI library can be loaded and used at runtime with no import libraries at link time . Biron combines this with `/NODEFAULTLIB` so that the executable is also free of the C runtime libraries such as the Universal C Runtime and the Visual C++ runtime.

## A future macOS implementation

macOS is not implemented yet, but the same idea should apply. The dynamic linker there is `dyld`, and every macOS process is bound to it rather than to a bare kernel interface, so a truly static executable is not available in the way it is on Linux. The capture would then center on obtaining `dyld` from the process, closer in spirit to reading the loader out of a Windows process than to reproducing a kernel handoff.

## The linker as a capability

The dynamic linker is never a build-time dependency of a Biron executable.[^hermetic] It is requested in `main`'s signature through the `System` effect and captured at startup, the same way the filesystem is. A Biron program states what it needs from the outside world. The dynamic linker is part of that too.

This is why every Biron program ships as a single static file with no shared-library dependencies and no fixed libc version. It still loads and resolves its system libraries at runtime through the linker it captured. Static deployment and dynamic loading are usually a choice between one and the other, but a Biron program takes both.

[^detour]: The detour mechanism is described in more detail at [graphitemaster/detour](https://github.com/graphitemaster/detour).
[^winimports]: The explicit Windows imports technique is described in more detail at [graphitemaster/windows_explicit_runtime_imports](https://github.com/graphitemaster/windows_explicit_runtime_imports).
[^hermetic]: This is hermetic dynamic linking. Hermeticity is covered in [Effects & Hermeticity](#effects).
