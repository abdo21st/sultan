---
description: إنشاء component جديد بسرعة
---

# إنشاء Component

يستخدم هذا الأمر لإنشاء React component جديد بالهيكل الصحيح.

## الخطوات

1. إنشاء script للـ component generator

```bash
# scripts/create-component.sh
#!/bin/bash

COMPONENT_NAME=$1
COMPONENT_DIR="app/components/$COMPONENT_NAME"

mkdir -p $COMPONENT_DIR

cat > $COMPONENT_DIR/$COMPONENT_NAME.tsx << EOF
"use client";

interface ${COMPONENT_NAME}Props {
  // Add props here
}

export default function ${COMPONENT_NAME}({}: ${COMPONENT_NAME}Props) {
  return (
    <div>
      <h1>${COMPONENT_NAME}</h1>
    </div>
  );
}
EOF

echo "✅ Component created: $COMPONENT_DIR/$COMPONENT_NAME.tsx"
```

1. تشغيل الأمر

```bash
bash scripts/create-component.sh MyComponent
```

## ملاحظات

- يمكن تخصيص القالب حسب الحاجة
- أضف CSS modules إذا لزم الأمر
- استخدم TypeScript للـ props
- اتبع naming conventions
