'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabasePage() {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setTestResult('');

    try {
      console.log('🔧 Testing Supabase connection...');
      console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('   Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing');

      // Test 1: Insert a test user
      const testEmail = `test-${Date.now()}@example.com`;
      console.log('📧 Inserting test user:', testEmail);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({ 
          email: testEmail,
          marketing_consent: true 
        })
        .select();

      if (userError) {
        console.error('❌ User insert error:', userError);
        setTestResult(`❌ FAILED: ${userError.message}\n\nDetails: ${JSON.stringify(userError, null, 2)}`);
        setLoading(false);
        return;
      }

      console.log('✅ User inserted:', userData);

      // Test 2: Read the user back
      const { data: readUser, error: readError } = await supabase
        .from('users')
        .select('*')
        .eq('email', testEmail)
        .single();

      if (readError) {
        console.error('❌ Read error:', readError);
        setTestResult(`❌ Insert OK but Read FAILED: ${readError.message}`);
        setLoading(false);
        return;
      }

      console.log('✅ User read back:', readUser);

      // Test 3: Insert a test trip
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_email: testEmail,
          trip_date: '2025-10-25',
          locations: [{ id: '1', name: 'Test Location', lat: 51.5, lng: -0.1, time: '09:00' }],
          trip_results: [{ test: 'data' }],
          traffic_predictions: { test: 'traffic' },
          executive_report: { test: 'report' }
        })
        .select()
        .single();

      if (tripError) {
        console.error('❌ Trip insert error:', tripError);
        setTestResult(`❌ User OK but Trip FAILED: ${tripError.message}\n\nDetails: ${JSON.stringify(tripError, null, 2)}`);
        setLoading(false);
        return;
      }

      console.log('✅ Trip inserted:', tripData);

      setTestResult(`✅ SUCCESS! All tests passed!

🎉 Supabase is working correctly!

Test User: ${testEmail}
Trip ID: ${tripData.id}

Database connection is fully functional.
You can now use the main app.`);

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      setTestResult(`❌ UNEXPECTED ERROR: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">
          🔧 Supabase Connection Test
        </h1>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Environment Variables:
          </h2>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 font-mono text-sm">
            <div className="mb-2">
              <span className="text-gray-600 dark:text-gray-400">NEXT_PUBLIC_SUPABASE_URL:</span>
              <br />
              <span className="text-blue-600 dark:text-blue-400">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ NOT SET'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
              <br />
              <span className="text-blue-600 dark:text-blue-400">
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Present' : '❌ NOT SET'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={testConnection}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all mb-6"
        >
          {loading ? '🔄 Testing...' : '🚀 Test Supabase Connection'}
        </button>

        {testResult && (
          <div className={`rounded-lg p-6 ${
            testResult.includes('SUCCESS') 
              ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' 
              : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
          }`}>
            <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200">
              {testResult}
            </pre>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          <p>This will test:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>Environment variables are loaded</li>
            <li>Supabase client is configured</li>
            <li>Can insert into users table</li>
            <li>Can read from users table</li>
            <li>Can insert into trips table</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

