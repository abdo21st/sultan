---
description: إنشاء API route جديد
---

# إنشاء API Route

يستخدم هذا الأمر لإنشاء API route جديد بالهيكل الصحيح.

## الخطوات

1. إنشاء script للـ API generator

```bash
# scripts/create-api.sh
#!/bin/bash

API_NAME=$1
API_DIR="app/api/$API_NAME"

mkdir -p $API_DIR

cat > $API_DIR/route.ts << EOF
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Add your logic here
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Add your logic here
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
EOF

echo "✅ API route created: $API_DIR/route.ts"
```

1. تشغيل الأمر

```bash
bash scripts/create-api.sh my-endpoint
```

## ملاحظات

- يتضمن authentication تلقائياً
- يتضمن error handling
- أضف validation للبيانات
- استخدم Prisma للتعامل مع قاعدة البيانات
