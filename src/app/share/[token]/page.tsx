'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ShareRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.token) {
      router.replace(`/s/${params.token}`);
    } else {
      router.replace('/');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin" />
    </div>
  );
}
