import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/budget/queries';

export async function GET() {
  try {
    const categories = await getCategories({ activeOnly: true });

    // Flatten categories including children
    const names: string[] = [];
    for (const cat of categories) {
      names.push(cat.name);
      if (cat.children) {
        for (const child of cat.children) {
          names.push(child.name);
        }
      }
    }

    return NextResponse.json({
      categories: names.sort()
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
