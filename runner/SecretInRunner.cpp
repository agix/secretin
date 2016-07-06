// SecretInRunner.cpp : définit le point d'entrée pour l'application console.
//

#include "stdafx.h"
#include <Windows.h>
#include <wtsapi32.h>
#include <TlHelp32.h>
#include <Strsafe.h>

#define SVCNAME L"Secret-in.me"

void SvcReportEvent(LPTSTR szFunction) {
	/*
	HKEY hkResult;
	RegCreateKey(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\services\\eventlog\\Application\\Secret-in.me", &hkResult);

	DWORD CategoryCount = 1;
	LPWSTR CategoryMessageFile[] = L""
	RegSetKeyValue(hkResult, NULL, L"CategoryCount", REG_DWORD, &CategoryCount, sizeof(CategoryCount));
	
	RegSetKeyValue(hkResult, NULL, L"CategoryMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"EventMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"ParameterMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"TypesSupported", REG_DWORD, EVENTLOG_AUDIT_FAILURE | EVENTLOG_AUDIT_SUCCESS);
	*/
	HANDLE hEventSource;
	LPCTSTR lpszStrings[2];
	TCHAR Buffer[80];
	hEventSource = RegisterEventSource(NULL, SVCNAME);
	if (NULL != hEventSource) {
		StringCchPrintf(Buffer, 80, L"%s failed with %d", szFunction, GetLastError());

		lpszStrings[0] = SVCNAME;
		lpszStrings[1] = Buffer;

		ReportEvent(hEventSource,
			EVENTLOG_ERROR_TYPE,
			0,
			0xC0020001L,
			NULL,
			2,
			0,
			lpszStrings,
			NULL);
	}
	DeregisterEventSource(hEventSource);
}

bool runSecretin() {
	HANDLE hToken;
	HANDLE hDupToken;
	HANDLE hProcessSnap;
	HANDLE hProcess;
	PROCESSENTRY32 pe;
	bool found = FALSE;

	hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, NULL);
	if (hProcessSnap == INVALID_HANDLE_VALUE) {
		SvcReportEvent(L"CreateToolhelp32Snapshot");
		return FALSE;
	}
	pe.dwSize = sizeof(PROCESSENTRY32);
	if (!Process32First(hProcessSnap, &pe)) {
		SvcReportEvent(L"Process32First");
		return FALSE;
	}
	do {
		if (wcsncmp(pe.szExeFile, L"winlogon.exe", 12) == NULL) {
			found = TRUE;
			break;
		}
	} while (Process32Next(hProcessSnap, &pe));

	if (!found) {
		SvcReportEvent(L"FindWinlogon");
		return FALSE;
	}

	hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pe.th32ProcessID);
	if (hProcess == 0) {
		SvcReportEvent(L"OpenProcess");
		return FALSE;
	}
	if (!OpenProcessToken(hProcess, TOKEN_ALL_ACCESS, &hToken)) {
		SvcReportEvent(L"OpenProcessToken");
		return FALSE;
	}

	if (!DuplicateTokenEx(hToken, TOKEN_ALL_ACCESS, NULL, SecurityImpersonation, TokenPrimary, &hDupToken)) {
		SvcReportEvent(L"DuplicateTokenEx");
		return FALSE;
	}

	STARTUPINFO si;
	PROCESS_INFORMATION pi;
	memset(&pi, 0, sizeof(PROCESS_INFORMATION));
	memset(&si, 0, sizeof(STARTUPINFO));
	si.cb = sizeof(STARTUPINFO);
	si.lpDesktop = L"WinSta0\\WinLogon";
	if (!CreateProcessAsUser(hToken, L"C:\\secret-in.me-win32-x64\\secret-in.me.exe", NULL, NULL, NULL, FALSE, 0, NULL, L"C:\\secret-in.me-win32-x64\\", &si, &pi)) {
		SvcReportEvent(L"CreateProcessAsUser");
		return FALSE;
	}

	return TRUE;
}

void WINAPI SvcCtrlHandler(DWORD dwCtrl) {
	return;
}

void WINAPI SvcMain(DWORD dwArgc, LPTSTR* lpszArgv) {
	SERVICE_STATUS gSvcStatus;
	SERVICE_STATUS_HANDLE gSvcStatusHandle = RegisterServiceCtrlHandler(SVCNAME, SvcCtrlHandler);
	if (!gSvcStatusHandle) {
		SvcReportEvent(L"RegisterServiceCtrlHandler");
		return;
	}

	gSvcStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS|SERVICE_INTERACTIVE_PROCESS;
	gSvcStatus.dwCurrentState = SERVICE_RUNNING;
	gSvcStatus.dwControlsAccepted = SERVICE_CONTROL_INTERROGATE;
	gSvcStatus.dwWin32ExitCode = NO_ERROR;
	gSvcStatus.dwServiceSpecificExitCode = NULL;
	gSvcStatus.dwCheckPoint = NULL;
	gSvcStatus.dwWaitHint = NULL;

	SetServiceStatus(gSvcStatusHandle, &gSvcStatus);

	runSecretin();
	gSvcStatus.dwCurrentState = SERVICE_STOPPED;
	
	SetServiceStatus(gSvcStatusHandle, &gSvcStatus);
}

int __stdcall WinMain(HINSTANCE hInst, HINSTANCE hPrevInst, char *szCmdLine, int iCmdShow)
{
	SERVICE_TABLE_ENTRY DispatchTable[] =
	{
		{SVCNAME, (LPSERVICE_MAIN_FUNCTION) SvcMain},
		{NULL, NULL}
	};
	if (!StartServiceCtrlDispatcher(DispatchTable)) {
		SvcReportEvent(L"StartServiceCtrlDispatcher");
	}

	return 0;
}
