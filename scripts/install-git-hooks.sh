#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    echo "Not a Git checkout; skipping automatic upgrade hooks."
    exit 0
fi

HOOKS_PATH="$(git -C "$REPO_DIR" config --get core.hooksPath || true)"
if [ -n "$HOOKS_PATH" ]; then
    if [[ "$HOOKS_PATH" != /* ]]; then
        HOOKS_PATH="$REPO_DIR/$HOOKS_PATH"
    fi
else
    HOOKS_PATH="$(git -C "$REPO_DIR" rev-parse --git-path hooks)"
    if [[ "$HOOKS_PATH" != /* ]]; then
        HOOKS_PATH="$REPO_DIR/$HOOKS_PATH"
    fi
fi
mkdir -p "$HOOKS_PATH"

for HOOK_NAME in post-merge post-rewrite; do
    HOOK="$HOOKS_PATH/$HOOK_NAME"
    BACKUP="$HOOK.cultify-prev"

    if [ -f "$HOOK" ] && grep -Fq '# cultify-auto-upgrade' "$HOOK"; then
        continue
    fi

    if [ -e "$HOOK" ]; then
        if [ -e "$BACKUP" ]; then
            echo "Cannot install $HOOK: backup already exists at $BACKUP" >&2
            exit 1
        fi
        cp -p "$HOOK" "$BACKUP"
        echo "Saved existing $HOOK as $BACKUP"
    fi

    cat > "$HOOK" <<EOF
#!/usr/bin/env bash
set -euo pipefail
# cultify-auto-upgrade
if [[ -x "$BACKUP" ]]; then
    "$BACKUP" "\$@"
fi
TARGET="\$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
STAMP="$REPO_DIR/.cultify-version"
if [[ -f "\$STAMP" ]] && [[ "\$(tr -d '[:space:]' < "\$STAMP")" == "\$TARGET" ]]; then
    exit 0
fi
bash "$REPO_DIR/termux/upgrade.sh"
EOF
    chmod +x "$HOOK"
    echo "Installed automatic upgrade hook: $HOOK_NAME"
done