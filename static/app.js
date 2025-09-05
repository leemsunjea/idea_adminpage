// 참조 데이터 설정 저장 함수는 이제 savePrompt 함수에 통합되었습니다.

// 전역 변수 (파일 최상단에 추가)
let chatSessionsData = []; // 채팅 세션 데이터 전역 변수
let currentUserInfo = null;
let settingsLoaded = false;
let docsLoaded = false;
let chatLogsCache = {}; // 채팅 로그 캐시 (uuid -> logs)
let lastSortedSessions = []; // 최근 정렬 결과 저장
let chatSessionsLoaded = false; // 세션이 이미 로드되었는지 여부
let chatSessionsLoading = false; // 세션 로딩 중인지 여부

// 참조 데이터 설정 로드 함수
function loadReferenceSettings() {
  try {
    // Load settings from localStorage (or from API in a real application)
    const referencesEnabled = localStorage.getItem('referencesEnabled') !== 'false'; // Default to true
    const downloadButtonEnabled = localStorage.getItem('downloadButtonEnabled') !== 'false'; // Default to true

    // Set toggle values
    document.getElementById('toggle-references').checked = referencesEnabled;
    document.getElementById('toggle-download-button').checked = downloadButtonEnabled;
  } catch (error) {
    console.error('설정 로드 중 오류 발생:', error);
  }
}

// 알림 함수(파일 최상단에 위치)
function showNotification(message, type = 'info') {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast' + (type === 'success' ? ' success' : type === 'error' ? ' error' : '');
  toast.style.display = 'block';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 400);
  }, 2100);
}

// 사이드바 토글 설정
// Prompt Form Functions
function setupPromptForm() {
    // 더 이상 동적으로 prompt-container를 생성하지 않음 (중앙 폼에 직접 추가됨)
    // 중앙 폼의 저장 버튼에 이벤트 연결만 수행
    // 상단 저장 버튼 클릭 시 폼 입력값을 백엔드로 전송
    
    // form submit 기본동작 방지
    const promptForm = document.getElementById('prompt-settings-form');
    if (promptForm) {
      promptForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
          await savePrompt();
          showNotification('설정이 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
          console.error('저장 중 오류 발생:', error);
          showNotification(error.message || '저장 중 오류가 발생했습니다.', 'error');
        }
      });
    }
}

// Save button state management
function setSaveButtonLoading(button, isLoading) {
    if (!button) return;
    
    // Find the button text and loading elements
    const buttonText = button.querySelector('.button-text');
    const buttonLoading = button.querySelector('.button-loading');
    
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        
        // Show loading state if elements exist
        if (buttonText) buttonText.style.display = 'none';
        if (buttonLoading) buttonLoading.style.display = 'inline-flex';
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        
        // Show normal state
        if (buttonText) buttonText.style.display = 'inline';
        if (buttonLoading) buttonLoading.style.display = 'none';
    }
}

// Show save message
function showSaveMessage(message, type = 'success') {
    const messageElement = document.getElementById('save-message');
    if (!messageElement) return;
    
    // Set message content and type
    messageElement.textContent = message;
    messageElement.className = 'save-message';
    messageElement.classList.add(type, 'show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, 3000);
}

async function savePrompt(event) {
    // Prevent form submission if called from a form
    if (event) {
        event.preventDefault();
    }
    
    // Get the button that was clicked (if any)
    const saveButton = event && event.submitter 
        ? event.submitter 
        : document.getElementById('save-prompt-btn');
    
    // Set loading state
    if (saveButton) {
        setSaveButtonLoading(saveButton, true);
    }
    
    // Clear any existing messages after a short delay to allow loading message to show
    setTimeout(() => {
        const messageElement = document.getElementById('save-message');
        if (messageElement) {
            messageElement.className = 'save-message';
        }
    }, 50);
    
    // Get prompt data
    const aiGreeting = document.getElementById('ai-greeting')?.value.trim() || '';
    const trainingData = document.getElementById('training-data')?.value.trim() || '';
    const instructionData = document.getElementById('instruction-data')?.value.trim() || '';

    // Get GPT settings
    const model = document.getElementById('gpt-model')?.value || 'gpt-4o-mini';
    const temperature = parseFloat(document.getElementById('temperature')?.value) || 0.7;
    const maxTokens = parseInt(document.getElementById('max-tokens')?.value) || 2048;
    
    // Get toggle values
    const referencesEnabled = document.getElementById('toggle-references')?.checked ?? true;
    const downloadButtonEnabled = document.getElementById('toggle-download-button')?.checked ?? true;

    try {
        // Validate required fields (optional validation)
        // if (!trainingData) {
        //     throw new Error('학습데이터는 필수 항목입니다.');
        // }
        
        // Combine all data into a single payload
        const payload = {
            // Prompt data
            ai_greeting: aiGreeting,
            training_data: trainingData,
            instruction_data: instructionData,
            
            // GPT settings
            gpt_settings: {
                model: model,
                temperature: temperature,
                max_tokens: maxTokens
            },
            
            // Reference data settings
            reference_settings: {
                references_enabled: referencesEnabled,
                download_button_enabled: downloadButtonEnabled
            }
        };

        // Show loading message
        showSaveMessage('저장 중입니다...', 'info');
        
        // Save to backend → Google Sheets
        const response = await fetch('/api/save-settings', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || '서버 응답이 올바르지 않습니다.');
        }

        // Show success message
        showSaveMessage('설정이 성공적으로 저장되었습니다!', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showSaveMessage(error.message || '저장 중 오류가 발생했습니다.', 'error');
    } finally {
        // Reset button states for both save buttons
        const saveButtons = [
            document.getElementById('save-prompt-btn'),
            document.querySelector('#gpt-settings-form button[type="submit"]')
        ];
        
        saveButtons.forEach(button => {
            if (button) {
                setSaveButtonLoading(button, false);
            }
        });
    }
}

// 문서 목록을 가져오는 함수
async function loadDocumentList() {
  const documentList = document.getElementById('document-list');
  if (!documentList) return;

  try {
    documentList.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">
          <div class="flex justify-center items-center">
            <span class="loading-text" style="font-size:1.2em; margin-right:0.5em;">⏳</span>
            문서 목록을 불러오는 중...
          </div>
        </td>
      </tr>
    `;

    const response = await fetch('/api/documents', { headers: authHeaders(), credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('문서 목록을 불러오는데 실패했습니다.');
    }

    const data = await response.json();
    const documents = data.documents || data; // 백엔드 응답 형식에 맞게 조정
    
    if (documents.length === 0) {
      documentList.innerHTML = `
        <tr>
          <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
            업로드된 문서가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    // 문서 목록을 표 형식으로 렌더링
    documentList.innerHTML = documents.map(doc => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          <div>
            <div class="font-medium">${doc.name}</div>
            <div class="text-xs text-gray-500 mt-1">${doc.filename || ''}</div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          <div>청크: ${doc.chunks || 0}개</div>
          <div class="text-xs text-gray-500">벡터: ${doc.vector_count || 0}개</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            업로드 완료
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div>${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '알 수 없음'}</div>
          <button class="delete-doc-btn" data-doc-name="${encodeURIComponent(doc.name)}" style="margin-top:0.5em; color:#e35; background:none; border:none; cursor:pointer; font-size:0.95em;">삭제</button>
        </td>
      </tr>
    `).join('');

    // 삭제 버튼 이벤트 리스너 등록
    // 에러 메시지 표시 함수
    function showDocError(msg) {
      let msgBox = document.getElementById('doc-error-msg');
      if (!msgBox) {
        msgBox = document.createElement('div');
        msgBox.id = 'doc-error-msg';
        msgBox.style.background = '#4b1c1c';
        msgBox.style.color = '#fff';
        msgBox.style.padding = '8px 16px';
        msgBox.style.marginBottom = '8px';
        msgBox.style.borderRadius = '6px';
        msgBox.style.fontSize = '0.96em';
        msgBox.style.textAlign = 'center';
        msgBox.style.maxWidth = '600px';
        msgBox.style.margin = '0 auto 8px auto';
        const table = document.querySelector('.custom-table');
        if (table && table.parentNode) table.parentNode.insertBefore(msgBox, table);
      }
      msgBox.textContent = msg;
      msgBox.style.display = 'block';
      setTimeout(() => { msgBox.style.display = 'none'; }, 2200);
    }

    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        const docName = decodeURIComponent(this.dataset.docName);
        const row = this.closest('tr');
        if (row) {
          row.style.transition = 'opacity 0.5s';
          row.style.opacity = '0.5';
          this.disabled = true;
        }
        try {
          const res = await fetch(`/api/documents/${encodeURIComponent(docName)}`, { method: 'DELETE', headers: authHeaders(), credentials: 'same-origin' });
          if (res.ok) {
            if (row) {
              row.style.opacity = '0';
              setTimeout(() => { row.remove(); }, 500);
            }
          } else {
            const err = await res.json();
            if (row) {
              row.style.opacity = '1';
              this.disabled = false;
            }
            showDocError('삭제 실패: ' + (err.detail || '알 수 없는 오류'));
          }
        } catch (err) {
          if (row) {
            row.style.opacity = '1';
            this.disabled = false;
          }
          showDocError('삭제 중 오류 발생: ' + err.message);
        }
      });
    });

  } catch (error) {
    console.error('문서 목록 로드 오류:', error);
    documentList.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">
          문서 목록을 불러오는 중 오류가 발생했습니다: ${error.message}
          <button onclick="loadDocumentList()" class="ml-2 text-blue-500 hover:text-blue-700">
            다시 시도
          </button>
        </td>
      </tr>
    `;
  }
}

  // Initialize reference data settings when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    // Initialize reference data settings
    loadReferenceSettings();
    
    
    // 로그인 체크 → 이후 초기화(무거운 데이터는 탭 진입 시 로드)
    initAuthAndGuard();
    
    
    
    // 프롬프트 설정 저장 버튼 초기화
    setupPromptSaveButton();
  
  // 새로고침 버튼 이벤트 리스너 추가
  const refreshBtn = document.getElementById('refresh-docs-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDocumentList);
  }
  
  // Add event listeners for toggle switches to save automatically when toggled
  const toggleReferences = document.getElementById('toggle-references');
  const toggleDownloadButton = document.getElementById('toggle-download-button');
  
  function handleToggleChange() {
    // Save to localStorage immediately for better UX
    const referencesEnabled = document.getElementById('toggle-references').checked;
    const downloadButtonEnabled = document.getElementById('toggle-download-button').checked;
    
    localStorage.setItem('referencesEnabled', referencesEnabled);
    localStorage.setItem('downloadButtonEnabled', downloadButtonEnabled);
    
    // Trigger save
    savePrompt();
  }
  
  if (toggleReferences) {
    toggleReferences.addEventListener('change', handleToggleChange);
  }
  
  if (toggleDownloadButton) {
    toggleDownloadButton.addEventListener('change', handleToggleChange);
  }
  // Chatbot Connection Elements
  const chatbotUrlInput = document.getElementById('chatbot-url');
  const checkStatusBtn = document.getElementById('check-status-btn');
  const saveChatbotUrlBtn = document.getElementById('save-chatbot-url');
  const copyIframeBtn = document.getElementById('copy-iframe-code');
  const connectionStatus = document.getElementById('connection-status');
  const lastChecked = document.getElementById('last-checked');
  const previewStatus = document.getElementById('preview-status');
  const chatbotIframe = document.getElementById('chatbot-iframe');
  const noPreview = document.getElementById('no-preview');
  const iframeModal = document.getElementById('iframe-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const copyCodeBtn = document.getElementById('copy-code');
  const iframeCode = document.getElementById('iframe-code');
  
  // Load saved chatbot URL if exists
  const savedChatbotUrl = localStorage.getItem('chatbotUrl');
  if (savedChatbotUrl) {
    chatbotUrlInput.value = savedChatbotUrl;
    updateIframePreview(savedChatbotUrl);
    checkChatbotStatus(savedChatbotUrl);
  }
  
  // Event Listeners
  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        checkChatbotStatus(url);
      } else {
        showNotification('챗봇 URL을 입력해주세요.', 'error');
      }
    });
  }
  
  if (saveChatbotUrlBtn) {
    saveChatbotUrlBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        localStorage.setItem('chatbotUrl', url);
        updateIframePreview(url);
        checkChatbotStatus(url);
        showNotification('챗봇 URL이 저장되었습니다.', 'success');
      } else {
        showNotification('유효한 URL을 입력해주세요.', 'error');
      }
    });
  }
  
  if (copyIframeBtn) {
    copyIframeBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        showIframeCodeModal(url);
      } else {
        showNotification('먼저 챗봇 URL을 저장해주세요.', 'error');
      }
    });
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      iframeModal.classList.remove('show');
    });
  }
  
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', copyIframeCodeToClipboard);
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === iframeModal) {
      iframeModal.classList.remove('show');
    }
  });

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');

  if (!hamburgerBtn || !sidebar) {
    console.error('햄버거 버튼 또는 사이드바를 찾을 수 없습니다.');
    return;
  }

  function toggleSidebar() {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    const icon = hamburgerBtn.querySelector('svg');
    if (isCollapsed) {
      icon.innerHTML = '<path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.remove('sidebar-open');
    } else {
      icon.innerHTML = '<path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.add('sidebar-open');
    }
  }

  hamburgerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
  });

  document.addEventListener('click', function (e) {
    const isMobile = window.innerWidth <= 768;
    const isSidebarOpen = !sidebar.classList.contains('collapsed');
    const isClickInsideSidebar = e.target.closest('.sidebar');
    const isClickOnHamburger = e.target === hamburgerBtn;

    if (isMobile && isSidebarOpen && !isClickInsideSidebar && !isClickOnHamburger) {
      toggleSidebar();
    }
  });

  const isMobileView = window.innerWidth <= 768;
  if (isMobileView) {
    sidebar.classList.add('collapsed');
  }

  // 탭 전환 기능 초기화
  function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // 모든 버튼 비활성화
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 선택한 탭 컨텐츠 표시
    let activeSection;
    if (tabId === 'admin-management') {
      // 관리자 기능 제거됨
      return;
    } else {
      activeSection = document.getElementById(tabId + '-content') || document.getElementById(tabId);
      console.log('Looking for', tabId + '-content or #' + tabId + ':', activeSection);
    }
    
    if (activeSection) {
      activeSection.classList.add('active');
      console.log('Successfully activated section:', activeSection.id);
    } else {
      console.error('Section not found for tab:', tabId);
      // 디버깅을 위해 모든 content-section 출력
      const allSections = document.querySelectorAll('.content-section');
      console.log('Available sections:', Array.from(allSections).map(s => s.id));
    }
    
    // 선택한 버튼 활성화 (탭 ID → 버튼 ID 매핑)
    const buttonIdMap = {
      'chatbot-connect': 'chatbotconnect',
      'chat-history': 'chatHistory',
      'gpt-setting': 'gptsetting',
      'prompt-setting': 'promptsetting',
      'data-setting': 'datasetting',
      'reference-data': 'referencedatasetting',
    };
    const btnId = buttonIdMap[tabId] || tabId;
    const activeButton = document.getElementById(btnId);
    if (activeButton) {
      activeButton.classList.add('active');
      console.log('Activated button:', btnId);
    } else {
      console.error('Button not found for tab:', tabId);
    }

    // 챗봇 연결 탭이 활성화되면 자동으로 상태 확인
    if (tabId === 'chatbot-connect') {
      const chatbotUrlInput = document.getElementById('chatbot-url');
      if (chatbotUrlInput && chatbotUrlInput.value) {
        checkChatbotStatus(chatbotUrlInput.value);
      }
    }
  }
  
  // 사이드바 버튼에 이벤트 리스너 추가
  document.getElementById('chatbotconnect').addEventListener('click', () => {
    switchTab('chatbot-connect');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  // 채팅 기록 버튼에 이벤트 리스너 추가
  document.getElementById('chatHistory').addEventListener('click', () => {
    switchTab('chat-history');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
    // 채팅 기록 불러오기 (이미 로드된 경우 재요청하지 않음)
    if (!chatSessionsLoaded && !chatSessionsLoading) {
      loadChatSessions();
    } else {
      // 이미 데이터가 있으면 리스트만 다시 표시
      setupSortOptions();
      displaySortedSessions('default');
    }
  });
  
  document.getElementById('gptsetting').addEventListener('click', () => {
    switchTab('gpt-setting');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('promptsetting').addEventListener('click', () => {
    switchTab('prompt-setting');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('datasetting').addEventListener('click', () => {
    switchTab('data-setting');
    if (!docsLoaded) { docsLoaded = true; loadDocumentList(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('referencedatasetting').addEventListener('click', () => {
    switchTab('reference-data');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  
  // 기본으로 챗봇 연결 탭 표시
  switchTab('chatbot-connect');
  
  // API 키 표시/숨기기 토글
  const apiKeyInput = document.getElementById('openai-api-key');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  
  if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener('click', () => {
      const type = apiKeyInput.type === 'password' ? 'text' : 'password';
      apiKeyInput.type = type;
      
      // 아이콘 업데이트
      const icon = toggleApiKeyBtn.querySelector('svg');
      if (type === 'text') {
        icon.innerHTML = '<path d="M3 12C3 12 7 4 12 4C19 4 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12C3 12 7 20 12 20C19 20 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15V15C13.6569 15 15 13.6569 15 12Z" fill="currentColor"/>';
      } else {
        icon.innerHTML = '<path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12C1 12 5 20 12 20C19 20 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>';
      }
    });
  }
  
  // Temperature 슬라이더 값 표시
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperature-value');
  
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', (e) => {
      temperatureValue.textContent = e.target.value;
    });
  }
  
  // Initialize character counters
  function updateCharCount(textarea, counterId) {
    const count = textarea.value.length;
    const counter = document.getElementById(counterId);
    if (counter) {
      counter.textContent = count;
      
      // Change color if approaching or exceeding limit
      const maxLength = parseInt(counter.textContent.split('/')[1]);
      if (count > maxLength * 0.9) {
        counter.style.color = '#ef4444'; // Red for approaching or exceeding limit
      } else {
        counter.style.color = '#9ca3af'; // Default gray
      }
    }
  }

  // Initialize character count for all textareas
  document.addEventListener('input', function(e) {
    const textarea = e.target;
    if (textarea.id === 'ai-greeting') {
      updateCharCount(textarea, 'greeting-count');
    } else if (textarea.id === 'training-data') {
      updateCharCount(textarea, 'training-count');
    } else if (textarea.id === 'instruction-data') {
      updateCharCount(textarea, 'instruction-count');
    }
  });

  // GPT Setting tab click handler
  document.getElementById('gptsetting')?.addEventListener('click', () => {
    switchTab('gpt-setting');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  // Initialize save buttons
  function initializeSaveButtons() {
    // First save button (inside form)
    const gptSettingsForm = document.getElementById('gpt-settings-form');
    if (gptSettingsForm) {
        gptSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePrompt(e);
        });
    }

    // Second save button (outside form)
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn) {
        savePromptBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            savePrompt(e);
        });
    }
    
    // 프롬프트 설정 폼 저장 버튼 이벤트 리스너 추가
    const promptSettingsForm = document.getElementById('prompt-settings-form');
    if (promptSettingsForm) {
        promptSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePrompt(e);
        });
    }
  }

  // Initialize buttons when DOM is ready
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeSaveButtons);
  } else {
      initializeSaveButtons();
  }

  // 저장된 설정이 있다면 불러오기
  function loadSavedSettings() {
    // 실제로는 서버에서 설정을 불러오는 API 호출이 필요합니다.
    // 예: fetch('/api/gpt-settings').then(...)
    
    // 예시: 로컬 스토리지에서 설정 불러오기 (임시)
    const savedSettings = localStorage.getItem('gptSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (apiKeyInput) apiKeyInput.value = settings.apiKey || '';
        
        const modelSelect = document.getElementById('gpt-model');
        if (modelSelect && settings.model) {
          modelSelect.value = settings.model;
        }
        
        if (temperatureSlider) {
          temperatureSlider.value = settings.temperature || 0.7;
          temperatureValue.textContent = settings.temperature || '0.7';
        }
      } catch (e) {
        console.error('설정을 불러오는 중 오류가 발생했습니다.', e);
      }
    }
  }
  
  // 모든 설정을 불러와 폼에 채우는 함수
  async function loadAllSettings(retryCount = 0) {
    try {
      // 로딩 중 UI 업데이트
      setInputsDisabled(true);
      
      // 백엔드 API에서 설정 데이터 가져오기
      const response = await fetch('/api/load-settings', {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      
      const result = await response.json();
      const settings = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 불러온 데이터 콘솔 출력 (디버깅용)
      console.log('n8n에서 받아온 settings:', settings);
      
      if (settings) {
        try {
          // 1. 프롬프트 데이터 설정
          const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
              element.value = value || '';
              console.log(`Set ${id}:`, value, typeof value);
            } else {
              console.error(`Element with id '${id}' not found`);
            }
          };
          
          // 2. HTML 요소 존재 여부 확인
          console.log('Checking HTML elements...');
          console.log('gpt-model exists:', !!document.getElementById('gpt-model'));
          console.log('temperature exists:', !!document.getElementById('temperature'));
          console.log('max-tokens exists:', !!document.getElementById('max-tokens'));
          
          // 3. 프롬프트 데이터 설정 (API 필드명과 HTML id 매핑)
          if ('ai_greeting' in settings) setValue('ai-greeting', settings.ai_greeting);
          if ('training_data' in settings) setValue('training-data', settings.training_data);
          if ('instruction_data' in settings) setValue('instruction-data', settings.instruction_data);
          
          // 4. GPT 설정 (API 필드명과 HTML id 매핑)
          if ('gpt_model' in settings) setValue('gpt-model', settings.gpt_model);
          if ('temperature' in settings) setValue('temperature', settings.temperature);
          if ('max_tokens' in settings) setValue('max-tokens', settings.max_tokens);
          
          console.log('Setting values:', {
            'gpt-model': settings.gpt_model,
            temperature: settings.temperature,
            'max-tokens': settings.max_tokens
          });
          
          // 5. 슬라이더 값 업데이트
          updateSliderValue('temperature');
          
          // 6. 토글 설정 업데이트
          if ('references_enabled' in settings) {
            const toggleReferences = document.getElementById('toggle-references');
            if (toggleReferences) {
              toggleReferences.checked = settings.references_enabled === true;
              localStorage.setItem('referencesEnabled', settings.references_enabled);
            }
          }
          
          if ('download_button_enabled' in settings) {
            const toggleDownloadButton = document.getElementById('toggle-download-button');
            if (toggleDownloadButton) {
              toggleDownloadButton.checked = settings.download_button_enabled === true;
              localStorage.setItem('downloadButtonEnabled', settings.download_button_enabled);
            }
          }
          
          // 7. 글자 수 업데이트
          updateCharCount(document.getElementById('ai-greeting'), 'greeting-count');
          updateCharCount(document.getElementById('training-data'), 'training-count');
          updateCharCount(document.getElementById('instruction-data'), 'instruction-count');
        } catch (error) {
          console.error('Error while setting values:', error);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // 재시도 로직: 최대 3번까지 재시도
      if (retryCount < 3) {
        console.log(`설정 로드 실패, ${retryCount + 1}번째 재시도...`);
        showNotification(`설정 로드 실패, ${retryCount + 1}번째 재시도 중...`, 'warning');
        // 2초 후 재시도
        setTimeout(() => {
          loadAllSettings(retryCount + 1);
        }, 2000);
        return;
      } else {
        // 최대 재시도 횟수 초과 시 에러 표시
        showNotification('설정을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        // 재시도 버튼 표시
        showRetryButton();
      }
    } finally {
      // 에러가 발생하지 않았을 때만 입력 필드 활성화
      if (retryCount === 0 || retryCount >= 3) {
      setInputsDisabled(false);
      }
    }
  }
  
  // 재시도 버튼 표시 함수
  function showRetryButton() {
    // 기존 재시도 버튼이 있다면 제거
    const existingRetryBtn = document.getElementById('retry-settings-btn');
    if (existingRetryBtn) {
      existingRetryBtn.remove();
    }
    
    // 재시도 버튼 생성
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retry-settings-btn';
    retryBtn.className = 'retry-btn';
    retryBtn.innerHTML = '🔄 설정 다시 불러오기';
    retryBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      z-index: 1001;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    // 재시도 버튼 클릭 이벤트
    retryBtn.addEventListener('click', () => {
      retryBtn.remove();
      loadAllSettings();
    });
    
    document.body.appendChild(retryBtn);
  }
  
  // 토글 설정 불러오기
  async function loadToggleSettings() {
    try {
      // 외부 API 호출 대신 localStorage에서 설정을 불러오거나 기본값 사용
      const toggleReferences = document.getElementById('toggle-references');
      const toggleDownloadButton = document.getElementById('toggle-download-button');
      
      if (toggleReferences) {
        const savedReferences = localStorage.getItem('referencesEnabled');
        if (savedReferences !== null) {
          toggleReferences.checked = savedReferences === 'true';
        }
      }
      
      if (toggleDownloadButton) {
        const savedDownloadButton = localStorage.getItem('downloadButtonEnabled');
        if (savedDownloadButton !== null) {
          toggleDownloadButton.checked = savedDownloadButton === 'true';
        }
      }
      
      console.log('Toggle settings loaded successfully');
    } catch (error) {
      console.error('Error loading toggle settings:', error);
      // 기본값 사용 (이미 HTML에 설정됨)
    }
  }
  
  // 페이지 로드 시 토글 설정 불러오기
  loadToggleSettings();

  // 문서 업로드 폼 이벤트 리스너
  const uploadForm = document.getElementById('document-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleDocumentUpload);
  }

  // 파일 선택 시 표시 텍스트 업데이트
  const fileInput = document.getElementById('document-file');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // 파일이 선택되면 ::before 콘텐츠를 파일명으로 변경
        this.style.setProperty('--file-name', `"${file.name}"`);
        this.classList.add('file-selected');
      } else {
        // 파일이 선택되지 않으면 기본 텍스트로 복원
        this.style.removeProperty('--file-name');
        this.classList.remove('file-selected');
      }
    });
  }

  // 문서 업로드 처리 함수
  async function handleDocumentUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('document-file');
    const uploadBtn = document.getElementById('upload-btn');
    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoading = uploadBtn.querySelector('.btn-loading');
    
    if (!fileInput.files[0]) {
      showNotification('파일을 선택해주세요.', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    
    // 파일 크기 체크 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      showNotification('파일 크기가 50MB를 초과합니다.', 'error');
      return;
    }
    
    // PDF 파일 체크
    if (file.type !== 'application/pdf') {
      showNotification('PDF 파일만 업로드 가능합니다.', 'error');
      return;
    }
    
    try {
      // 업로드 버튼 비활성화 및 로딩 상태
      uploadBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: authHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '업로드에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        showNotification(`문서가 성공적으로 업로드되었습니다. (${result.total_chunks}개 청크)`, 'success');
        
        // 파일 입력 초기화
        fileInput.value = '';
        
        // 문서 목록 새로고침
        loadDocumentList();
      } else {
        throw new Error(result.message || '업로드에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('문서 업로드 오류:', error);
      showNotification(`업로드 실패: ${error.message}`, 'error');
    } finally {
      // 업로드 버튼 활성화 및 로딩 상태 해제
      uploadBtn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  }

  // 참조 데이터 수량 선택 관련 기능
  const quantityInput = document.getElementById('dataQuantity');
  const decreaseBtn = document.getElementById('decreaseQuantity');
  const increaseBtn = document.getElementById('increaseQuantity');
  const referenceDataItems = document.getElementById('referenceDataItems');
  const referenceDataForm = document.getElementById('reference-data-form');
  
  // 수량 변경 시 참조 데이터 항목 업데이트
  function updateReferenceDataItems(quantity) {
    if (!referenceDataItems) return;
    referenceDataItems.innerHTML = '';
    
    // 화면 크기에 따라 컬럼 수 조정
    const screenWidth = window.innerWidth;
    let columns = 3; // 기본 3열
    if (screenWidth < 1200) columns = 2;
    if (screenWidth < 768) columns = 1;
    
    // 그리드 템플릿 컬럼 업데이트
    referenceDataItems.style.gridTemplateColumns = `repeat(${columns}, minmax(280px, 1fr))`;
    
    // 각 항목 생성
    for (let i = 1; i <= quantity; i++) {
      const item = document.createElement('div');
      item.className = 'reference-item';
      item.innerHTML = `
        <h4>참조 데이터 ${i}</h4>
        <div class="form-group">
          <label for="ref-title-${i}">제목</label>
          <input type="text" id="ref-title-${i}" class="form-input" placeholder="참조 데이터 제목을 입력하세요">
        </div>
        <div class="form-group">
          <label for="ref-url-${i}">URL</label>
          <div class="input-with-button">
            <input type="url" id="ref-url-${i}" class="form-input" placeholder="https://example.com">
          </div>
        </div>
        <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
          <label for="ref-description-${i}">설명 (선택사항)</label>
          <textarea 
            id="ref-description-${i}" 
            class="form-textarea" 
            style="flex: 1; min-height: 80px;" 
            placeholder="참조 데이터에 대한 간단한 설명을 입력하세요"
          ></textarea>
        </div>
      `;
      referenceDataItems.appendChild(item);
    }
    
    // 창 크기 변경 이벤트 리스너 추가
    window.addEventListener('resize', handleResize);
  }
  
  // 폼 제출 처리
  if (referenceDataForm) {
    referenceDataForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const quantity = parseInt(quantityInput.value);
      const referenceData = [];
      
      // 모든 참조 데이터 수집
      for (let i = 1; i <= quantity; i++) {
        const title = document.getElementById(`ref-title-${i}`)?.value.trim();
        const url = document.getElementById(`ref-url-${i}`)?.value.trim();
        const description = document.getElementById(`ref-description-${i}`)?.value.trim();
        
        // 필수 필드 확인
        if (title && url) {
          referenceData.push({
            title,
            url,
            description: description || ''
          });
        }
      }
      
      // 여기서 서버로 데이터 전송
      console.log('참조 데이터 저장:', referenceData);
      showNotification('참조 데이터가 저장되었습니다.', 'success');
      
      // 로컬 스토리지에 저장 (데모용)
      localStorage.setItem('referenceData', JSON.stringify({
        quantity,
        items: referenceData
      }));
    });
  }
  
  // 창 크기 변경 핸들러
  function handleResize() {
    if (!referenceDataItems) return;
    const screenWidth = window.innerWidth;
    let columns = 3;
    if (screenWidth < 1200) columns = 2;
    if (screenWidth < 768) columns = 1;
    referenceDataItems.style.gridTemplateColumns = `repeat(${columns}, minmax(280px, 1fr))`;
  }
  
  // Chatbot Connection Functions
  async function checkChatbotStatus(url) {
    if (!url) return;
    
    // Show loading state
    updateStatus('checking', '연결 확인 중...');
    
    try {
      // Use GET method instead of HEAD as it's more widely supported
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        // Add headers to minimize data transfer
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      // Even with no-cors mode, we can't read the response, but the request was sent
      // So we'll assume if we get here, the endpoint is reachable
      updateStatus('online', '온라인');
      updateIframePreview(url);
      // Save the working URL
      localStorage.setItem('chatbotUrl', url);
      
      // Update preview status
      previewStatus.textContent = '챗봇이 정상적으로 연결되었습니다.';
      noPreview.style.display = 'none';
      chatbotIframe.style.display = 'block';
      
    } catch (error) {
      console.error('Error checking chatbot status:', error);
      updateStatus('offline', '오프라인');
      // Show error in preview
      previewStatus.textContent = '챗봇에 연결할 수 없습니다.';
      noPreview.style.display = 'block';
      chatbotIframe.style.display = 'none';
    }
    
    updateLastChecked();
  }
  
  function updateStatus(status, text) {
    // Update status indicator
    const indicator = document.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = 'status-indicator';
      indicator.classList.add(status);
    }
    
    // Update status text and value
    if (connectionStatus) {
      connectionStatus.textContent = text;
      connectionStatus.className = 'status-value';
      connectionStatus.classList.add(status);
    }
    
    // Update preview status badge
    if (previewStatus) {
      previewStatus.className = 'status-badge';
      previewStatus.classList.add(status);
      previewStatus.textContent = text;
      
      // Update status button text and state
      const statusBtn = document.getElementById('check-status-btn');
      if (statusBtn) {
        statusBtn.disabled = status === 'checking';
      }
    }
    
    // Update status button text
    const statusBtnText = checkStatusBtn?.querySelector('span:last-child');
    if (statusBtnText) {
      statusBtnText.textContent = text === '확인 중...' ? '확인 중...' : '상태 확인';
    }
    
    // Update status button indicator
    const statusBtnIndicator = checkStatusBtn?.querySelector('.status-indicator');
    if (statusBtnIndicator) {
      statusBtnIndicator.className = 'status-indicator';
      statusBtnIndicator.classList.add(status);
    }
  }
  
  function updateLastChecked() {
    if (!lastChecked) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    lastChecked.textContent = timeString;
  }
  
  function updateIframePreview(url) {
    if (!chatbotIframe || !noPreview) return;
    
    if (url) {
      chatbotIframe.src = url;
      chatbotIframe.style.display = 'block';
      noPreview.style.display = 'none';
    } else {
      chatbotIframe.src = '';
      chatbotIframe.style.display = 'none';
      noPreview.style.display = 'flex';
    }
  }
  
  function showIframeCodeModal(url) {
    if (!iframeModal || !iframeCode) return;
    
    const iframeHtml = `<iframe 
                  src="${url}" 
                  width="100%" 
                  height="600" 
                  frameborder="0" 
                  style="border: 1px solid #e5e7eb; border-radius: 0.375rem;"
                  allowfullscreen>
                </iframe>`;
    
    iframeCode.textContent = iframeHtml;
    iframeModal.classList.add('show');
  }
  
  async function copyIframeCodeToClipboard() {
    if (!iframeCode) return;
    
    try {
      await navigator.clipboard.writeText(iframeCode.textContent);
      showNotification('코드가 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      showNotification('코드 복사에 실패했습니다.', 'error');
    }
  }
  
  // 알림을 표시할 컨테이너 생성
  const notificationContainer = document.createElement('div');
  notificationContainer.id = 'notification-container';
  notificationContainer.style.position = 'fixed';
  notificationContainer.style.top = '20px';
  notificationContainer.style.right = '20px';
  notificationContainer.style.zIndex = '1000';
  document.body.appendChild(notificationContainer);

  function showNotification(message, type = 'info') {
    // 알림 요소 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 알림을 컨테이너에 추가
    notificationContainer.appendChild(notification);
    
    // 3초 후에 알림 제거
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // 입력 필드들 비활성화/활성화 함수
  function setInputsDisabled(disabled) {
    const inputs = [
      document.getElementById('ai-greeting'),
      document.getElementById('training-data'),
      document.getElementById('instruction-data')
    ];
    
    inputs.forEach(input => {
      if (input) {
        input.disabled = disabled;
        input.placeholder = disabled ? '데이터를 불러오는 중입니다...' : '';
      }
    });
    
    // 로딩 메시지 표시/숨김
    const loadingElements = document.querySelectorAll('.loading-message');
    if (loadingElements.length === 0 && disabled) {
      // 로딩 메시지 추가 (이미 있으면 추가하지 않음)
      const loadingHtml = `
        <div class="loading-message" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
          text-align: center;
        ">
          <div class="spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
          "></div>
          <p>데이터를 불러오는 중입니다...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .form-textarea-container {
            position: relative;
          }
          .form-textarea[disabled] {
            opacity: 0.7;
            background-color: #f8f9fa;
          }
        </style>
      `;
      
      // 각 텍스트에어리어 컨테이너에 로딩 메시지 추가
      document.querySelectorAll('.form-group').forEach(container => {
        const textarea = container.querySelector('.form-textarea');
        if (textarea) {
          const wrapper = document.createElement('div');
          wrapper.className = 'form-textarea-container';
          wrapper.style.position = 'relative';
          textarea.parentNode.insertBefore(wrapper, textarea);
          wrapper.appendChild(textarea);
          wrapper.insertAdjacentHTML('beforeend', loadingHtml);
        }
      });
    } else if (!disabled) {
      // 로딩 완료 시 로딩 메시지 제거
      loadingElements.forEach(el => el.remove());
    }
  }

  // 프롬프트 데이터를 가져와 폼에 채우는 함수
  async function loadPromptData() {
    try {
      // 입력 필드 비활성화 및 로딩 상태 표시
      setInputsDisabled(true);
      
      const response = await fetch('/api/load-settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('프롬프트 데이터를 가져오는데 실패했습니다.');
      }
      
      const result = await response.json();
      const item = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 데이터가 있으면 각 필드에 할당
      if (item) {
        const greetingField = document.getElementById('ai-greeting');
        const trainingField = document.getElementById('training-data');
        const instructionField = document.getElementById('instruction-data');
        
        if (greetingField) greetingField.value = item.aiGreeting || '';
        if (trainingField) trainingField.value = item.trainingData || '';
        if (instructionField) instructionField.value = item.instructionData || '';
        
        // 문자 수 업데이트
        if (greetingField) updateCharCount(greetingField, 'greeting-count');
        if (trainingField) updateCharCount(trainingField, 'training-count');
        if (instructionField) updateCharCount(instructionField, 'instruction-count');
        
        console.log('프롬프트 데이터를 성공적으로 불러왔습니다.');
      }
    } catch (error) {
      console.error('프롬프트 데이터 로드 중 오류 발생:', error);
      showNotification('프롬프트 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      // 로딩 완료 후 입력 필드 다시 활성화
      setInputsDisabled(false);
    }
  }

  // GPT 설정 저장 핸들러
  async function saveGptSettings(event) {
    event.preventDefault();
    
    const model = document.getElementById('gpt-model').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const maxTokens = parseInt(document.getElementById('max-tokens').value);
    
    try {
      const response = await fetch('https://imsunjea1149.app.n8n.cloud/webhook/d750cfb9-c102-4f33-951b-6e11bd41e6af', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          temperature: temperature,
          max_tokens: maxTokens
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showNotification('GPT 설정이 성공적으로 저장되었습니다.', 'success');
      } else {
        throw new Error(result.detail || '설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving GPT settings:', error);
      showNotification(error.message || '설정 저장 중 오류가 발생했습니다.', 'error');
    }
  }
  
  // 저장된 GPT 설정 불러오기
  async function loadGptSettings() {
    try {
      const response = await fetch('/api/load-settings', { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to load settings');
      
      const result = await response.json();
      const settings = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 설정이 있으면 폼에 적용
      if (settings) {
        const modelSelect = document.getElementById('gpt-model');
        const temperatureInput = document.getElementById('temperature');
        const maxTokensInput = document.getElementById('max-tokens');
        
        if (modelSelect && settings['gpt-model']) {
          modelSelect.value = settings['gpt-model'];
        }
        
        if (temperatureInput && settings.temperature !== undefined) {
          temperatureInput.value = settings.temperature;
          // 슬라이더 값 업데이트
          updateSliderValue('temperature');
        }
        
        if (maxTokensInput && settings['max-tokens'] !== undefined) {
          maxTokensInput.value = settings['max-tokens'];
        }
      }
    } catch (error) {
      console.error('Error loading GPT settings:', error);
      // 기본값 사용 (이미 HTML에 설정됨)
    }
  }
  
  // 슬라이더 값 업데이트 함수
  function updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(`${sliderId}-value`);
    if (slider && valueSpan) {
      valueSpan.textContent = slider.value;
    }
  }

  // 프롬프트 폼 및 저장 버튼 show/hide 통합 관리
  setupPromptForm();
  
  // 프롬프트 설정 섹션과 저장 버튼을 보이도록 설정
  showPromptCategorySection(true);

  function showPromptCategorySection(show) {
    const form = document.getElementById('prompt-settings-form');
    const saveBtn = document.getElementById('save-prompt-btn'); // id 통일
    if (form) form.style.display = show ? 'block' : 'none';
    if (saveBtn) saveBtn.style.display = show ? 'block' : 'none';
  }
  
  // 프롬프트 설정 저장 버튼 상태 관리 개선
  function setupPromptSaveButton() {
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn) {
      // 저장 버튼에 로딩 상태 클래스 추가
      savePromptBtn.classList.add('save-btn-with-loading');
      
      // 저장 버튼 클릭 이벤트
      savePromptBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        try {
          await savePrompt(e);
          showSaveMessage('프롬프트 설정이 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
          console.error('프롬프트 저장 중 오류 발생:', error);
          showSaveMessage(error.message || '저장 중 오류가 발생했습니다.', 'error');
        }
      });
    }
  }

  // Initialize GPT settings form event listeners
  (function initGptSettings() {
    const temperatureSlider = document.getElementById('temperature');
    
    // Remove form submission handler since we're using a single save button
    const gptSettingsForm = document.getElementById('gpt-settings-form');
    if (gptSettingsForm) {
      gptSettingsForm.onsubmit = (e) => {
        e.preventDefault();
        savePrompt();
      };
    }
    
    // Keep temperature slider value update
    if (temperatureSlider) {
      temperatureSlider.addEventListener('input', () => updateSliderValue('temperature'));
    }
  })();

  // 프롬프트 카테고리 탭 클릭 시만 폼/버튼 보이기
  document.getElementById('promptsetting')?.addEventListener('click', () => {
    showPromptCategorySection(true);
  });
  // 다른 탭 클릭 시 폼/버튼 숨김
  ['chatbotconnect','gptsetting','datasetting','referencedatasetting'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      showPromptCategorySection(false);
    });
  });

  // 초기 참조 데이터 로드
  const savedData = localStorage.getItem('referenceData');
  if (savedData) {
    try {
      const { quantity, items } = JSON.parse(savedData);
      if (quantity >= 3 && quantity <= 6) {
        quantityInput.value = quantity;
        updateReferenceDataItems(quantity);
        
        // 저장된 데이터로 폼 채우기
        items.forEach((item, index) => {
          const i = index + 1;
          const titleInput = document.getElementById(`ref-title-${i}`);
          const urlInput = document.getElementById(`ref-url-${i}`);
          const descInput = document.getElementById(`ref-description-${i}`);
          
          if (titleInput) titleInput.value = item.title;
          if (urlInput) urlInput.value = item.url;
          if (descInput) descInput.value = item.description || '';
        });
        
        // 버튼 상태 업데이트
        decreaseBtn.disabled = quantity <= 3;
        increaseBtn.disabled = quantity >= 6;
      }
    } catch (e) {
      console.error('저장된 데이터를 불러오는 중 오류 발생:', e);
      // 기본값으로 초기화
      updateReferenceDataItems(3);
    }
  } else {
    // 기본값으로 초기화
    updateReferenceDataItems(3);
  }









// ===== Chat history functions =====
// HTML escape utility to prevent XSS and render plain text safely
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
async function loadChatSessions() {
  try {
    // 이미 로드된 경우 재요청 방지
    if (chatSessionsLoaded || chatSessionsLoading) {
      // 정렬만 갱신
      setupSortOptions();
      displaySortedSessions('default');
      return;
    }
    chatSessionsLoading = true;
    const sidebar = document.querySelector('#chat-history-content .chat-list');
    const messages = document.querySelector('#chat-history-content .chat-messages');
    
    // 빠른 로딩 피드백
    if (sidebar) {
      sidebar.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">세션을 불러오는 중...</div></div>';
    }
    
    const res = await fetch('/api/chat/sessions', { 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'same-origin' 
    });
    if (!res.ok) throw new Error('세션 목록 로드 실패');
    
    const json = await res.json();
    chatSessionsData = json.data || []; // 전역 변수에 저장
    
    // 정렬 옵션 이벤트 리스너 설정 (중복 바인딩 방지)
    setupSortOptions();
    
    // 기본 정렬로 세션 표시 (상위 5개 미리 로딩 없음)
    displaySortedSessions('default');
    
    if (messages) {
      messages.innerHTML = '<div style="padding:8px;color:#9ca3af;">좌측에서 세션을 선택하세요. (순차적 로딩으로 변경됨)</div>';
    }
    chatSessionsLoaded = true;
  } catch (e) {
    console.error('채팅 세션 로드 실패:', e);
    if (sidebar) {
      sidebar.innerHTML = '<div style="padding:8px;color:#ef4444;">세션을 불러오는데 실패했습니다.</div>';
    }
  } finally {
    chatSessionsLoading = false;
  }
}

// 전역에서 접근 가능하도록 노출 (로그인 성공 시 자동 로드에 사용)
window.loadChatSessions = loadChatSessions;

async function loadChatLogs(uuid) {
  try {
    const messages = document.querySelector('#chat-history-content .chat-messages');

    // 캐시된 로그가 있으면 즉시 렌더링
    const cached = chatLogsCache && chatLogsCache[uuid];
    if (cached && messages) {
      renderLogs(cached);
      return;
    }

    // 로딩 상태 표시 (더 빠른 피드백)
    if (messages) {
      messages.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">채팅을 불러오는 중...</div></div>';
    }
    
    // 순차적 로딩을 위한 지연 (사용자 경험 개선)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const res = await fetch(`/api/chat/logs/${encodeURIComponent(uuid)}`, { 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'same-origin' 
    });
    if (!res.ok) throw new Error('채팅 로그 로드 실패');
    const json = await res.json();
    const logs = json.data || [];
    
    // 캐시에 저장 (메모리 효율성 향상)
    if (Object.keys(chatLogsCache).length > 50) {
      // 캐시가 너무 커지면 오래된 항목 제거
      const keys = Object.keys(chatLogsCache);
      const oldestKey = keys[0];
      delete chatLogsCache[oldestKey];
    }
    chatLogsCache[uuid] = logs;

    if (messages) {
      renderLogs(logs);
    }

    function renderLogs(logsToRender) {
      messages.innerHTML = logsToRender.map(l => {
        const role = (l.role || '').toLowerCase();
        const isBot = role === 'assistant';
        const isUser = role === 'user';
        const content = l.message || '';
        const ts = l.timestamp ? new Date(l.timestamp).toLocaleString('ko-KR') : '';
        const references = l.metadata?.references || '';
        const referencesBtn = references ? `
          <div class="references-actions">
            <button class="references-chip" data-ref="${encodeURIComponent(references)}" title="참조 보기">참조 보기</button>
          </div>
        ` : '';
        if (isUser) {
          return `<div class="message message-user">
                    <div class="message-content-wrapper">
                      <div class="message-timestamp">${ts}</div>
                      <div class="message-content">${escapeHtml(content)}</div>
                    </div>
                  </div>`;
        } else {
          return `<div class="message message-bot">
                    <div class="message-content-wrapper">
                      <div class="message-content">${escapeHtml(content)}</div>
                      <div class="message-timestamp">${ts}</div>
                    </div>
                    ${referencesBtn}
                  </div>`;
        }
      }).join('');
      messages.querySelectorAll('.references-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const ref = btn.getAttribute('data-ref');
          const text = ref ? decodeURIComponent(ref) : '';
          showReferencesModal(text || '참조 데이터가 없습니다.');
        });
      });
    }
  } catch (e) {
    console.error('채팅 로그 로드 실패:', e);
    const messages = document.querySelector('#chat-history-content .chat-messages');
    if (messages) {
      messages.innerHTML = '<div style="padding:8px;color:#ef4444;">채팅 로그를 불러오는데 실패했습니다. 다시 시도해주세요.</div>';
    }
  }
}

// 상위 N개 세션의 로그를 백그라운드에서 미리 불러오기 (제거됨 - 순차적 로딩으로 변경)
// async function prefetchTopChatLogs(count = 5) {
//   try {
//     if (!Array.isArray(lastSortedSessions) || lastSortedSessions.length === 0) return;
//     const top = lastSortedSessions.slice(0, count);
//     const uuids = top.map(s => s.uuid || s.UUID || s.Uuid || Object.values(s)[0]).filter(Boolean);
//     const tasks = uuids.map(async (uuid) => {
//       if (chatLogsCache[uuid]) return; // 이미 캐시됨
//       try {
//         const res = await fetch(`/api/chat/logs/${encodeURIComponent(uuid)}`, { headers: authHeaders(), credentials: 'same-origin' });
//         if (!res.ok) return;
//         const json = await res.json().catch(() => ({}));
//         const logs = json.data || [];
//         chatLogsCache[uuid] = logs;
//       } catch (_) { /* ignore */ }
//     });
//     // 백그라운드 실행 (대기하지 않음)
//     Promise.allSettled(tasks);
//   } catch (_) { /* ignore */ }
// }


function setupSortOptions() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    // 중복 리스너 방지
    if (sortSelect.dataset.bound === 'true') return;
    sortSelect.dataset.bound = 'true';
    sortSelect.addEventListener('change', (e) => {
      const sortType = e.target.value;
      console.log('Sort option changed to:', sortType);
      
      // 정렬 변경 시 즉시 재정렬 및 표시
      displaySortedSessions(sortType);
      
      // 정렬 변경 알림
      const sortLabels = {
        'default': '최근 대화순',
        'messages-desc': '대화쌍 많은순',
        'messages-asc': '대화쌍 적은순',
        'text-desc': '텍스트 많은순',
        'text-asc': '텍스트 적은순'
      };
      
      const label = sortLabels[sortType] || sortType;
      showNotification(`정렬이 '${label}'으로 변경되었습니다.`, 'info');
    });
  }
}

function displaySortedSessions(sortType) {
  const sidebar = document.querySelector('#chat-history-content .chat-list');
  if (!sidebar) return;
  
  // 빈 배열일 때 메시지 표시
  if (!chatSessionsData.length) {
    sidebar.innerHTML = '<div style="padding:8px;color:#9ca3af;">저장된 채팅 세션이 없습니다.</div>';
    return;
  }
  
  let sortedSessions = [...chatSessionsData];
  
  switch (sortType) {
    case 'messages-desc':
      sortedSessions.sort((a, b) => {
        const countA = parseInt(a.message_count || 0);
        const countB = parseInt(b.message_count || 0);
        return countB - countA;
      });
      break;
      
    case 'messages-asc':
      sortedSessions.sort((a, b) => {
        const countA = parseInt(a.message_count || 0);
        const countB = parseInt(b.message_count || 0);
        return countA - countB;
      });
      break;
      
    case 'text-desc':
      sortedSessions.sort((a, b) => {
        const textA = (a.message_count || 0) * 100; // 대략적인 텍스트 길이 추정
        const textB = (b.message_count || 0) * 100;
        return textB - textA;
      });
      break;
      
    case 'text-asc':
      sortedSessions.sort((a, b) => {
        const textA = (a.message_count || 0) * 100;
        const textB = (b.message_count || 0) * 100;
        return textA - textB;
      });
      break;
      
    default:
      // 기본 순서: 대화의 시작시간(started_at)을 기준으로 최신 대화가 맨 위에 오도록 정렬
      sortedSessions.sort((a, b) => {
        // started_at (대화 시작 시간)을 우선으로 사용
        const timeA = new Date(a.started_at || 0);
        const timeB = new Date(b.started_at || 0);
        
        // 끝시간이 더 최근인 대화가 맨 위에 오도록 내림차순 정렬
        // 예: 2025.08.13이 2025.07.30보다 위에 표시됨
        const result = timeB - timeA;
        console.log(`Sort result: ${result} (${timeB} - ${timeA})`);
        return result;
      });
      break;
  }
  
  // 최근 정렬 상태 저장
  lastSortedSessions = sortedSessions;
  // 상위 5개 대화 로그 미리 불러오기 (제거됨 - 순차적 로딩으로 변경)
  // prefetchTopChatLogs(5);
  
  // 정렬된 세션 표시
  sidebar.innerHTML = sortedSessions.map((s, index) => {
    const uuid = s.session_uuid || '';
    const started = s.started_at ? new Date(s.started_at).toLocaleString('ko-KR') : '';
    const ended = s.ended_at ? new Date(s.ended_at).toLocaleString('ko-KR') : '';
    const count = s.message_count || 0;
    
    // 정렬 순서 표시 (1, 2, 3...)
    const orderNumber = index + 1;
    
    return `<div class="chat-item" data-uuid="${uuid}" data-order="${orderNumber}">
             <div class="session-order">${orderNumber}</div>
             <div class="uuid-text">${uuid}</div>
             <div class="session-info">
               <div class="session-times">
                 <span class="time-label">시작:</span> ${started || '알 수 없음'}
                 ${ended ? `<br><span class="time-label">종료:</span> ${ended}` : ''}
               </div>
               <div class="session-meta">
                 <div class="meta-left">
                   <span class="message-count">${count}개 메시지</span>
                   <span class="sort-priority">${ended ? '종료시간 기준' : '시작시간 기준'}</span>
                 </div>
               </div>
             </div>
           </div>`;
  }).join('');
  
  // 클릭 이벤트 리스너 다시 설정
  sidebar.querySelectorAll('.chat-item').forEach(el => {
    el.addEventListener('click', () => {
      const uuid = el.getAttribute('data-uuid');
      
      // 이전 활성 세션 제거
      sidebar.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
      
      // 로딩 상태 표시
      el.classList.add('loading');
      
      // 채팅 로그 로딩
      loadChatLogs(uuid).finally(() => {
        // 로딩 완료 후 로딩 상태 제거
        el.classList.remove('loading');
      });
    });
  });
  
  // 정렬 변경 애니메이션 효과
  setTimeout(() => {
    sidebar.querySelectorAll('.chat-item').forEach((el, index) => {
      el.classList.add('sorting');
      setTimeout(() => {
        el.classList.remove('sorting');
      }, 100 + (index * 50)); // 순차적으로 애니메이션 적용
    });
  }, 100);
}

// ===== References Modal Helpers =====
function ensureReferencesModal() {
  let modal = document.getElementById('references-modal');
  if (modal) return modal;
  
  modal = document.createElement('div');
  modal.id = 'references-modal';
  modal.className = 'references-modal';
  modal.innerHTML = `
    <div class="references-modal-box">
      <div class="references-modal-header">
        <span>참조 자료</span>
        <button class="references-modal-close" aria-label="닫기">×</button>
      </div>
      <div id="references-modal-body" class="references-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 닫기 이벤트
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'references-modal') hideReferencesModal();
  });
  modal.querySelector('.references-modal-close')?.addEventListener('click', hideReferencesModal);
  
  // ESC 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) hideReferencesModal();
  });
  
  return modal;
}

function showReferencesModal(text) {
  const modal = ensureReferencesModal();
  const body = document.getElementById('references-modal-body');
  if (body) body.textContent = '';
  if (body) body.innerText = text; // 텍스트만 표시 (보안상)
  modal.classList.add('show');
}

function hideReferencesModal() {
  const modal = document.getElementById('references-modal');
  if (modal) modal.classList.remove('show');
}

}); // DOMContentLoaded 함수 종료

// ===== Authentication & Permissions =====
async function initAuthAndGuard() {
  // 인증 없이 바로 UI 표시
  showLoggedInUI();
  // 채팅 세션 자동 로드는 UI 표시 후 백그라운드에서 시작
  if (typeof window.loadChatSessions === 'function') {
    setTimeout(() => window.loadChatSessions(), 0);
  }
}



function applyPermissionsToUI() {
  // 권한 체크 없이 모든 기능 활성화
}

async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders(), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', headers: authHeaders(), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

function authHeaders() {
  return { 'Accept': 'application/json' };
}






// 사용자 권한 렌더링
function renderUserPermissions(username, perms) {
  const permsGrid = document.getElementById('perms-grid');
  if (!permsGrid) return;
  
  const categories = currentUserInfo?.categories || ['chatbot-connect','chat-history','gpt-setting','prompt-setting','data-setting','reference-data'];
  
  permsGrid.innerHTML = categories.map(cat => {
    const item = perms[cat] || { can_view: false, can_save: false };
    const idView = `perm-${cat}-view`;
    const idSave = `perm-${cat}-save`;
    return `
      <div class="perm-item">
        <div class="perm-category">${cat}</div>
        <div class="perm-controls">
          <div class="perm-toggle">
            <span>조회</span>
            <label class="toggle-switch">
              <input type="checkbox" id="${idView}" ${item.can_view ? 'checked' : ''}>
              <span class="toggle-slider round"></span>
            </label>
          </div>
          <div class="perm-toggle">
            <span>저장</span>
            <label class="toggle-switch">
              <input type="checkbox" id="${idSave}" ${item.can_save ? 'checked' : ''} ${!item.can_view ? 'disabled' : ''}>
              <span class="toggle-slider round"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      }).join('');
  
  // 조회 권한 변경 시 저장 권한 자동 제어
  categories.forEach(cat => {
    const viewCheckbox = document.getElementById(`perm-${cat}-view`);
    const saveCheckbox = document.getElementById(`perm-${cat}-save`);
    
    if (viewCheckbox && saveCheckbox) {
      viewCheckbox.addEventListener('change', function() {
        if (!this.checked) {
          // 조회를 끄면 저장도 끄기
          saveCheckbox.checked = false;
          saveCheckbox.disabled = true;
        } else {
          // 조회를 켜면 저장 활성화
          saveCheckbox.disabled = false;
        }
      });
      
      // 초기 상태 설정
      if (!viewCheckbox.checked) {
        saveCheckbox.disabled = true;
      }
    }
  });
  
  // 권한 저장 버튼 이벤트 리스너
  const savePermsBtn = document.getElementById('save-permissions');
  if (savePermsBtn) {
    savePermsBtn.onclick = async () => {
      try {
        setSaveButtonLoading(savePermsBtn, true);
        
        const payload = { username, permissions: [] };
        categories.forEach(cat => {
          const view = document.getElementById(`perm-${cat}-view`);
          const save = document.getElementById(`perm-${cat}-save`);
          if (view && save) {
            payload.permissions.push({ category: cat, can_view: view.checked, can_save: save.checked });
          }
        });
        
        await apiPost('/api/admin/permissions', payload);
        
        // 캐시 무효화
        adminUsersCache = null;
        adminUsersCacheTime = 0;
        
        showNotification('권한 저장 완료', 'success');
        
                // 자신의 권한을 업데이트한 경우 UI 새로고침
        if (currentUserInfo?.username === username) {
          const me = await apiGet('/api/admin/me');
          currentUserInfo = me.data;
          applyPermissionsToUI();
          
          // 참조데이터 토글 버튼 권한 재설정
          const toggleReferences = document.getElementById('toggle-references');
          const toggleDownloadButton = document.getElementById('toggle-download-button');
          
          if (toggleReferences && toggleDownloadButton) {
            const canSaveReference = currentUserInfo.is_super_admin || (currentUserInfo.permissions && currentUserInfo.permissions['reference-data'] && currentUserInfo.permissions['reference-data'].can_save);
            
            toggleReferences.disabled = !canSaveReference;
            toggleDownloadButton.disabled = !canSaveReference;
            
            if (!canSaveReference) {
              toggleReferences.style.opacity = '0.5';
              toggleReferences.style.cursor = 'not-allowed';
              toggleDownloadButton.style.opacity = '0.5';
              toggleDownloadButton.style.cursor = 'not-allowed';
            } else {
              toggleReferences.style.opacity = '1';
              toggleReferences.style.cursor = 'pointer';
              toggleDownloadButton.style.opacity = '1';
              toggleDownloadButton.style.cursor = 'pointer';
            }
          }
        }
  } catch (e) {
        console.error('권한 저장 실패:', e);
        showNotification(e.message || '권한 저장에 실패했습니다.', 'error');
      } finally {
        setSaveButtonLoading(savePermsBtn, false);
      }
    };
  }
}

// 관리자 이벤트 핸들러 설정

// 로그인 상태로 UI 표시
function showLoggedInUI() {
  const chatContainer = document.querySelector('.chat-container');
  const sidebar = document.getElementById('sidebar');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  
  if (chatContainer) chatContainer.classList.remove('not-logged-in');
  if (sidebar) sidebar.classList.remove('not-logged-in');
  if (hamburgerBtn) hamburgerBtn.classList.remove('not-logged-in');
}