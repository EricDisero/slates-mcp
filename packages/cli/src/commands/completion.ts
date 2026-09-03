import { ALL_OPERATIONS, type Operation } from '@slatesvideo/shared'

// `slates completion bash|zsh|pwsh` — op ids are long, there are 91 of them,
// and every one starts with the same eleven characters. Tab completion is the
// difference between typing an id and remembering one.
//
// Generated from ALL_OPERATIONS at print time, so a new op completes the day it
// ships rather than the day someone remembers this file exists.

const COMMANDS = [
  'login',
  'logout',
  'status',
  'doctor',
  'setup',
  'mcp',
  'install-skills',
  'use',
  'run',
  'completion',
]

export function runCompletion(shell: string | undefined): void {
  const ops = (ALL_OPERATIONS as readonly Operation<unknown>[]).map((o) => o.id)
  const target = (shell ?? '').toLowerCase()

  if (target === 'bash') {
    console.log(`# slates bash completion — add to ~/.bashrc:
#   source <(slates completion bash)
_slates_completion() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [ "$prev" = "run" ]; then
    COMPREPLY=( $(compgen -W "${ops.join(' ')}" -- "$cur") )
  elif [ "$prev" = "completion" ]; then
    COMPREPLY=( $(compgen -W "bash zsh pwsh" -- "$cur") )
  elif [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${COMMANDS.join(' ')}" -- "$cur") )
  fi
}
complete -F _slates_completion slates`)
    return
  }

  if (target === 'zsh') {
    console.log(`# slates zsh completion — add to ~/.zshrc:
#   source <(slates completion zsh)
_slates() {
  local -a cmds ops
  cmds=(${COMMANDS.join(' ')})
  ops=(${ops.join(' ')})
  if (( CURRENT == 2 )); then
    compadd -- $cmds
  elif [[ \${words[2]} == run ]]; then
    compadd -- $ops
  elif [[ \${words[2]} == completion ]]; then
    compadd -- bash zsh pwsh
  fi
}
compdef _slates slates`)
    return
  }

  if (target === 'pwsh' || target === 'powershell') {
    console.log(`# slates PowerShell completion — add to $PROFILE:
#   slates completion pwsh | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName slates -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $tokens = $commandAst.ToString() -split '\\s+'
  $candidates = if ($tokens.Length -ge 2 -and $tokens[1] -eq 'run') {
    @(${ops.map((o) => `'${o}'`).join(',')})
  } elseif ($tokens.Length -ge 2 -and $tokens[1] -eq 'completion') {
    @('bash','zsh','pwsh')
  } else {
    @(${COMMANDS.map((c) => `'${c}'`).join(',')})
  }
  $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}`)
    return
  }

  console.error('Usage: slates completion bash|zsh|pwsh')
  console.error('  bash:  source <(slates completion bash)          in ~/.bashrc')
  console.error('  zsh:   source <(slates completion zsh)           in ~/.zshrc')
  console.error('  pwsh:  slates completion pwsh | Out-String | Invoke-Expression   in $PROFILE')
  process.exit(1)
}
