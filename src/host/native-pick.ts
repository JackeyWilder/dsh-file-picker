import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export interface NativePickResult {
  paths: string[]
  canceled: boolean
}

/**
 * C# interop + dialog driver compiled into the pwsh process. The WinForms
 * OpenFileDialog can silently render in legacy style under pwsh's shell, so
 * we drive the COM IFileOpenDialog (Vista+) — the same modern Explorer-style
 * dialog Electron apps (e.g. ZCode) show — in pure file mode with
 * FOS_ALLOWMULTISELECT | FOS_FORCEFILESYSTEM.
 *
 * The WHOLE dialog flow lives in C#: PowerShell 7 cannot cast a raw
 * __ComObject onto a custom [ComImport] interface (cast fails at runtime),
 * so PowerShell only calls the static Show() and receives a JSON string.
 *
 * GUIDs verified against the real COM object via QueryInterface probes:
 * - IFileOpenDialog   D57C7288-D4AD-4768-BE02-9D969532D960 (QI OK)
 * - IShellItem        43826d1e-e718-42ee-bc55-a1e261c37bfe (QI OK)
 * - CLSID_FileOpenDialog DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7
 *
 * vtable order is a hard constraint: IFileDialog has 23 methods (there is
 * NO GetFileTypeCount — adding one shifts every later slot and crashes with
 * AccessViolationException). Show -> SetFileTypes -> SetFileTypeIndex ->
 * GetFileTypeIndex -> Advise -> Unadvise -> SetOptions -> GetOptions -> ...
 * -> SetFilter -> GetResults -> GetSelectedItems.
 */
const COM_INTEROP = String.raw`
using System;
using System.Runtime.InteropServices;

public static class FpPicker {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct COMDLG_FILTERSPEC { public string pszName; public string pszSpec; }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
  public static extern int SHCreateItemFromParsingName(
    string pszPath, IntPtr pbc, ref Guid riid, out IntPtr ppv);

  [DllImport("ole32.dll")]
  public static extern void CoTaskMemFree(IntPtr pv);

  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IntPtr ppsi);
    [PreserveSig] int GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IntPtr psi, uint hint, out int piOrder);
  }

  [ComImport, Guid("b63ea76d-1f85-456f-a19c-48159efa858b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IShellItemArray {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetPropertyStore(uint flags, ref Guid riid, out IntPtr ppv);
    void GetPropertyDescriptionList(ref Guid keyType, ref Guid riid, out IntPtr ppv);
    void GetAttributes(uint attribFlags, uint sfgaoMask, out uint psfgaoAttribs);
    void GetCount(out uint pdwNumItems);
    void GetItemAt(uint dwIndex, out IntPtr ppsi);
    void EnumItems(out IntPtr ppenumShellItems);
  }

  [ComImport, Guid("d57c7288-d4ad-4768-be02-9d969532d960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr hwnd);
    void SetFileTypes(uint cFileTypes, [In, MarshalAs(UnmanagedType.LPArray)] COMDLG_FILTERSPEC[] rgFilterSpec);
    void SetFileTypeIndex(uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise(IntPtr pfde, out uint pdwCookie);
    void Unadvise(uint dwCookie);
    void SetOptions(uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IntPtr ppsi);
    void GetCurrentSelection(out IntPtr ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IntPtr ppsi);
    void AddPlace(IShellItem psi, int fdap);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(int hr);
    void SetClientGuid(ref Guid guid);
    void ClearClientData();
    void SetFilter(IntPtr pFilter);
    void GetResults(out IntPtr ppsai);
    void GetSelectedItems(out IntPtr ppsai);
  }

  private static string JsonEscape(string s) {
    return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
  }

  /// Show the multi-select file dialog and return a JSON string:
  /// ["C:\\a.txt", "C:\\b.txt"] or CANCELED.
  public static string Show(string initialDir) {
    var dialog = (IFileOpenDialog)Activator.CreateInstance(
      Type.GetTypeFromCLSID(new Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")));
    uint opts;
    dialog.GetOptions(out opts);
    // FOS_ALLOWMULTISELECT | FOS_FORCEFILESYSTEM (no FOS_PICKFOLDERS: file mode)
    dialog.SetOptions(opts | 0x200 | 0x40);
    dialog.SetTitle("选择文件");
    if (!string.IsNullOrEmpty(initialDir)) {
      IntPtr psi;
      var shellItemIid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
      if (SHCreateItemFromParsingName(initialDir, IntPtr.Zero, ref shellItemIid, out psi) == 0) {
        var item = (IShellItem)Marshal.GetObjectForIUnknown(psi);
        dialog.SetFolder(item);
      }
    }
    int hr = dialog.Show(IntPtr.Zero);
    if (hr != 0) return "CANCELED";
    IntPtr arrPtr;
    dialog.GetResults(out arrPtr);
    var array = (IShellItemArray)Marshal.GetObjectForIUnknown(arrPtr);
    uint count;
    array.GetCount(out count);
    var parts = new System.Collections.Generic.List<string>();
    for (uint i = 0; i < count; i++) {
      IntPtr itemPtr;
      array.GetItemAt(i, out itemPtr);
      var item = (IShellItem)Marshal.GetObjectForIUnknown(itemPtr);
      IntPtr namePtr;
      item.GetDisplayName(0x80058000, out namePtr); // SIGDN_FILESYSPATH
      string path = Marshal.PtrToStringUni(namePtr) ?? "";
      CoTaskMemFree(namePtr);
      parts.Add("\"" + JsonEscape(path) + "\"");
    }
    return "[" + string.Join(",", parts) + "]";
  }
}
`

/** Cache key: content-hashed so an interop change mints a fresh DLL. */
const CACHE_KEY = createHash('sha1').update(COM_INTEROP).digest('hex').slice(0, 10)

/**
 * Build the pwsh script that shows the native multi-select file dialog. The
 * dialog runs inside the Add-Type'd C# FpPicker.Show(). Compiling the ~80-line
 * interop on every pick costs ~1s (csc), so the compiled assembly is cached in
 * %TEMP%\dsh-file-picker\ and loaded with Add-Type -Path on later picks;
 * PowerShell only guards the initial dir and prints the JSON/CANCELED.
 */
export function buildPickerScript(initialDir: string | undefined): string {
  const esc = (s: string) => s.replace(/'/g, "''")
  const cacheDir = join(tmpdir(), 'dsh-file-picker')
  const cacheDll = join(cacheDir, `FpPicker-${CACHE_KEY}.dll`)
  const cacheDirEsc = esc(cacheDir)
  const cacheDllEsc = esc(cacheDll)
  const lines = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    `if (Test-Path '${cacheDllEsc}') {`,
    `  Add-Type -Path '${cacheDllEsc}'`,
    `} else {`,
    `  New-Item -ItemType Directory -Force -Path '${cacheDirEsc}' | Out-Null`,
    `  Add-Type -TypeDefinition @'\n${COM_INTEROP}\n'@ -OutputAssembly '${cacheDllEsc}'`,
    `}`,
  ]
  if (initialDir !== undefined) {
    const quoted = `'${esc(initialDir)}'`
    lines.push(
      `if (Test-Path -LiteralPath ${quoted}) { [FpPicker]::Show(${quoted}) } else { [FpPicker]::Show($null) }`,
    )
  } else {
    lines.push('[FpPicker]::Show($null)')
  }
  return lines.join('\n')
}

/** Parse the pwsh stdout into a pick result; anything unrecognized is a cancel. */
export function parsePickerOutput(out: string): NativePickResult {
  const trimmed = out.trim()
  if (trimmed === '' || trimmed === 'CANCELED') return { paths: [], canceled: true }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'string') {
      // @() in the script forces arrays, but tolerate a bare JSON string
      // (single-element pipeline unwrap) defensively.
      return { paths: parsed === '' ? [] : [parsed], canceled: false }
    }
    const paths = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
    return { paths, canceled: false }
  } catch {
    return { paths: [], canceled: true }
  }
}

/**
 * Show the native picker by running pwsh. The script is passed as a
 * UTF-16LE Base64 -EncodedCommand (pwsh-native, no temp file). After the
 * dialog closes, pwsh's exit is a timing race (it can linger on the
 * WinForms message pump), so we resolve on the first complete output line
 * and kill the process rather than waiting for a natural exit.
 */
export async function runNativePicker(initialDir: string | undefined, signal?: AbortSignal): Promise<NativePickResult> {
  const encoded = Buffer.from(buildPickerScript(initialDir), 'utf16le').toString('base64')
  return await new Promise((resolve, reject) => {
    const child = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let settled = false
    const finish = (result: NativePickResult): void => {
      if (settled) return
      settled = true
      child.kill()
      resolve(result)
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (data: string) => {
      out += data
      const trimmed = out.trim()
      if (trimmed === 'CANCELED') {
        finish({ paths: [], canceled: true })
        return
      }
      if (trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          finish({ paths: JSON.parse(trimmed) as string[], canceled: false })
        } catch {
          // Output line not complete yet; keep buffering.
        }
      }
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('PowerShell 7 (pwsh) not found on PATH; native file picker requires pwsh'))
        return
      }
      reject(error)
    })
    if (signal !== undefined) {
      signal.addEventListener('abort', () => {
        if (settled) return
        settled = true
        child.kill()
        reject(signal.reason)
      }, { once: true })
    }
    child.on('exit', () => {
      if (settled) return
      settled = true
      resolve(parsePickerOutput(out))
    })
  })
}
