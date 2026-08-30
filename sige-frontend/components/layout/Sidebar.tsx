'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useTheme } from './ThemeProvider';
import { useData } from '../../hooks/useApi';
import clsx from 'clsx';
import SigeOwl from '../brand/SigeOwl';

interface NavItem { href: string; icon: string; label: string; }
interface NavSection { label: string; items: NavItem[]; }

const NAV: Record<string, NavSection[]> = {
  SUPERADMIN: [
    { label: 'Principal', items: [
      { href: '/superadmin',                icon: 'bi-grid-1x2',       label: 'Dashboard'        },
      { href: '/superadmin/colegios',       icon: 'bi-building',       label: 'Colegios'         },
      { href: '/superadmin/usuarios',       icon: 'bi-people',         label: 'Usuarios'         },
      { href: '/superadmin/membresias',     icon: 'bi-credit-card',    label: 'Planes'           },
      { href: '/superadmin/licencias',      icon: 'bi-patch-check',    label: 'Licencias'        },
      { href: '/superadmin/facturacion',    icon: 'bi-cash-coin',      label: 'Facturación'      },
      { href: '/superadmin/monitoreo',      icon: 'bi-activity',       label: 'Monitoreo'        },
      { href: '/superadmin/roles-plan',     icon: 'bi-person-gear',    label: 'Roles por Plan'   },
      { href: '/superadmin/backups',        icon: 'bi-hdd-network',    label: 'Backups'          },
      { href: '/superadmin/auditoria',      icon: 'bi-shield-check',   label: 'Auditoría global' },
    ]},
    { label: 'Cuenta', items: [
      { href: '/superadmin/configuracion',  icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  ADMINISTRADOR: [
    { label: 'Principal', items: [
      { href: '/admin',                    icon: 'bi-grid-1x2',       label: 'Dashboard'        },
      { href: '/admin/estudiantes',        icon: 'bi-person-badge',   label: 'Estudiantes'      },
      { href: '/admin/asistencia',         icon: 'bi-calendar-check', label: 'Asistencia'       },
      { href: '/admin/padres',             icon: 'bi-people',         label: 'Padres'           },
      { href: '/admin/usuarios',           icon: 'bi-person-gear',    label: 'Usuarios'         },
      { href: '/admin/permisos',           icon: 'bi-door-open',      label: 'Permisos Salida'  },
      { href: '/director/reportes',        icon: 'bi-graph-up',       label: 'Reportes'         },
    ]},
    { label: 'Académico', items: [
      { href: '/admin/matriculas',         icon: 'bi-file-earmark-text', label: 'Matrículas'   },
      { href: '/admin/aulas',              icon: 'bi-door-open',      label: 'Aulas'            },
      { href: '/admin/secciones',          icon: 'bi-diagram-3',      label: 'Secciones'        },
      { href: '/admin/horarios',           icon: 'bi-calendar3',      label: 'Horarios'         },
      { href: '/admin/cursos',             icon: 'bi-journal-bookmark', label: 'Cursos'          },
      { href: '/admin/pagos',              icon: 'bi-cash-stack',     label: 'Pagos'            },
    ]},
    { label: 'Comunicación', items: [
      { href: '/admin/comunicados',        icon: 'bi-megaphone',      label: 'Comunicados'      },
      { href: '/admin/eventos',            icon: 'bi-calendar-event', label: 'Eventos'          },
    ]},
    { label: 'Sistema', items: [
      { href: '/admin/exportaciones',      icon: 'bi-download',       label: 'Exportaciones'    },
      { href: '/admin/facturacion',        icon: 'bi-cash-coin',      label: 'Facturación'      },
      { href: '/admin/carnet',             icon: 'bi-palette',        label: 'Plantilla Carnet' },
      { href: '/admin/auditoria',          icon: 'bi-shield-check',   label: 'Auditoría'        },
      { href: '/admin/configuracion',      icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  DIRECTOR: [
    { label: 'Principal', items: [
      { href: '/director',                 icon: 'bi-grid-1x2',       label: 'Dashboard'        },
      { href: '/director/estudiantes',     icon: 'bi-person-badge',   label: 'Estudiantes'      },
      { href: '/director/asistencia',      icon: 'bi-calendar-check', label: 'Asistencia'       },
      { href: '/director/pagos',           icon: 'bi-cash-stack',     label: 'Finanzas'         },
      { href: '/admin/facturacion',        icon: 'bi-cash-coin',      label: 'Facturación'      },
      { href: '/director/permisos',        icon: 'bi-door-open',      label: 'Permisos Salida'  },
      { href: '/director/reportes',        icon: 'bi-graph-up',       label: 'Reportes'         },
      { href: '/director/auditoria',       icon: 'bi-shield-check',   label: 'Auditoría'        },
      { href: '/carnet/plantilla',         icon: 'bi-palette',        label: 'Plantilla Carnet' },
    ]},
    { label: 'Cuenta', items: [
      { href: '/admin/configuracion',      icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  SECRETARIA: [
    { label: 'Principal', items: [
      { href: '/secretaria',               icon: 'bi-grid-1x2',       label: 'Dashboard'        },
      { href: '/secretaria/qr',            icon: 'bi-qr-code-scan',   label: 'QR Asistencia'    },
      { href: '/secretaria/asistencia',    icon: 'bi-calendar-check', label: 'Asistencia'       },
    ]},
    { label: 'Gestión', items: [
      { href: '/secretaria/estudiantes',   icon: 'bi-person-badge',   label: 'Estudiantes'      },
      { href: '/secretaria/padres',        icon: 'bi-people',         label: 'Padres'           },
      { href: '/secretaria/matriculas',    icon: 'bi-file-earmark-text', label: 'Matrículas'   },
      { href: '/secretaria/pagos',         icon: 'bi-cash-stack',     label: 'Pagos'            },
    ]},
    { label: 'Comunicación', items: [
      { href: '/secretaria/comunicados',   icon: 'bi-megaphone',      label: 'Comunicados'      },
      { href: '/secretaria/eventos',       icon: 'bi-calendar-event', label: 'Eventos'          },
      { href: '/secretaria/encuestas',     icon: 'bi-bar-chart',      label: 'Encuestas'        },
      { href: '/secretaria/documentos',    icon: 'bi-folder2',        label: 'Documentos'       },
      { href: '/secretaria/permisos',      icon: 'bi-door-open',      label: 'Permisos Salida'  },
      { href: '/secretaria/carnet',        icon: 'bi-palette',        label: 'Plantilla Carnet' },
      { href: '/secretaria/actas',         icon: 'bi-journal-check',  label: 'Actas'            },
    ]},
    { label: 'Cuenta', items: [
      { href: '/secretaria/configuracion', icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  DOCENTE: [
    { label: 'Principal', items: [
      { href: '/docente',                  icon: 'bi-grid-1x2',       label: 'Dashboard'        },
      { href: '/docente/alumnos',          icon: 'bi-people',         label: 'Mis Alumnos'      },
      { href: '/docente/notas',            icon: 'bi-journal-check',  label: 'Notas'            },
      { href: '/docente/chat',             icon: 'bi-chat-dots',      label: 'Mensajes'         },
      { href: '/docente/asistencia',       icon: 'bi-calendar-check', label: 'Asistencia'       },
      { href: '/docente/observaciones',    icon: 'bi-exclamation-triangle', label: 'Observaciones' },
      { href: '/docente/comunicados',      icon: 'bi-megaphone',      label: 'Comunicados'      },
      { href: '/docente/eventos',          icon: 'bi-calendar-event', label: 'Eventos'          },
      { href: '/docente/permisos',         icon: 'bi-door-open',      label: 'Permisos Salida'  },
      { href: '/docente/horarios',         icon: 'bi-calendar3',      label: 'Mis Horarios'     },
    ]},
    { label: 'Cuenta', items: [
      { href: '/docente/configuracion',    icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  PADRE: [
    { label: 'Mi Espacio', items: [
      { href: '/padre',                    icon: 'bi-house',          label: 'Inicio'           },
      { href: '/padre/hijos',              icon: 'bi-person-hearts',  label: 'Mis Hijos'        },
      { href: '/padre/asistencia',         icon: 'bi-calendar-check', label: 'Asistencia'       },
      { href: '/padre/boletin',            icon: 'bi-journal-check',  label: 'Boletín de Notas' },
      { href: '/padre/chat',               icon: 'bi-chat-dots',      label: 'Mensajes'         },
      { href: '/padre/pagos',              icon: 'bi-cash-stack',     label: 'Pagos'            },
      { href: '/padre/comunicados',        icon: 'bi-megaphone',      label: 'Comunicados'      },
      { href: '/padre/eventos',            icon: 'bi-calendar-event', label: 'Eventos'          },
      { href: '/padre/horarios',           icon: 'bi-clock',          label: 'Horarios'         },
      { href: '/padre/documentos',         icon: 'bi-folder2',        label: 'Documentos'       },
      { href: '/padre/encuestas',          icon: 'bi-bar-chart',      label: 'Encuestas'        },
    ]},
    { label: 'Cuenta', items: [
      { href: '/padre/configuracion',      icon: 'bi-gear',           label: 'Configuración'    },
    ]},
  ],
  // Roles opcionales — mismo nav que docente
  AUXILIAR: [
    { label: 'Auxiliar', items: [
      { href: '/auxiliar',                 icon: 'bi-grid-1x2',       label: 'Dashboard'          },
      { href: '/auxiliar/directorio',      icon: 'bi-people',         label: 'Directorio'         },
      { href: '/docente/asistencia',       icon: 'bi-calendar-check', label: 'Asistencia'         },
      { href: '/docente/observaciones',    icon: 'bi-exclamation-triangle', label: 'Observaciones' },
      { href: '/docente/permisos',         icon: 'bi-door-open',      label: 'Permisos Salida'    },
      { href: '/docente/horarios',         icon: 'bi-calendar3',      label: 'Mis Horarios'       },
    ]},
    { label: 'Cuenta', items: [
      { href: '/docente/configuracion',    icon: 'bi-gear',           label: 'Configuración'      },
    ]},
  ],
  PSICOLOGO: [
    { label: 'Psicología', items: [
      { href: '/psicologo',                icon: 'bi-grid-1x2',       label: 'Dashboard'          },
      { href: '/psicologo/registro',       icon: 'bi-journal-medical', label: 'Seguimiento'        },
      { href: '/psicologo/directorio',     icon: 'bi-people',         label: 'Directorio'         },
      { href: '/docente/horarios',         icon: 'bi-calendar3',      label: 'Mis Horarios'       },
      { href: '/docente/permisos',         icon: 'bi-door-open',      label: 'Permisos Salida'    },
    ]},
    { label: 'Cuenta', items: [
      { href: '/docente/configuracion',    icon: 'bi-gear',           label: 'Configuración'      },
    ]},
  ],
  COORDINADOR: [],
  TUTOR:       [],
  CONTADOR: [
    { label: 'Contabilidad', items: [
      { href: '/contador',                 icon: 'bi-grid-1x2',       label: 'Dashboard'          },
      { href: '/secretaria/pagos',         icon: 'bi-cash-coin',      label: 'Gestión de Pagos'   },
    ]},
    { label: 'Cuenta', items: [
      { href: '/docente/configuracion',    icon: 'bi-gear',           label: 'Configuración'      },
    ]},
  ],
  ENFERMERIA: [
    { label: 'Enfermería', items: [
      { href: '/enfermeria',               icon: 'bi-grid-1x2',       label: 'Dashboard'          },
      { href: '/enfermeria/registro',      icon: 'bi-heart-pulse',    label: 'Registro de Salud'  },
      { href: '/docente/horarios',         icon: 'bi-calendar3',      label: 'Mis Horarios'       },
      { href: '/docente/permisos',         icon: 'bi-door-open',      label: 'Permisos Salida'    },
    ]},
    { label: 'Cuenta', items: [
      { href: '/docente/configuracion',    icon: 'bi-gear',           label: 'Configuración'      },
    ]},
  ],
};

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open = true, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  if (!user) return null;

  // Enfermería y Psicología ahora tienen su propio nav (arriba) — ya no
  // heredan el de Docente, para que sus rutas/URLs sean propias y no
  // aparezcan como "/docente/..." (evita confusión y problemas de permisos).
  // Contador: antes heredaba TODO el nav de Administrador (sobre-permisionado
  // — un contador viendo "Gestión de Usuarios", "Matrículas", etc., nada de
  // lo cual debe tocar). Ahora tiene su propio nav (arriba), igual que
  // Enfermería/Psicología/Auxiliar.
  const rolNav = ['COORDINADOR','TUTOR'].includes(user.rol)
    ? NAV.DOCENTE
    : NAV[user.rol] ?? [];

  // Badge de mensajes sin leer — solo para los roles que tienen Chat
  // (Padre y la familia de roles tipo Docente). Se refresca cada 15s, no
  // hace falta más rapidez para un contador en el menú lateral.
  const tieneChat = ['PADRE','DOCENTE','AUXILIAR','TUTOR','COORDINADOR'].includes(user.rol);
  const { data: noLeidosData } = useData<any>(tieneChat ? '/chat/no-leidos' : null, { refreshInterval: 15000 });
  const noLeidos = noLeidosData?.total ?? 0;

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/secretaria' || href === '/docente' ||
        href === '/padre' || href === '/director' || href === '/superadmin') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Overlay móvil */}
      <AnimatePresence>
        {open && (
          <motion.div className="d-md-none"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
        )}
      </AnimatePresence>

      <aside className={clsx('sige-sidebar', open && 'open')}>
        {/* Encabezado colegio */}
        <div style={{ padding: '1.25rem 1rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user.colegio?.logoUrl ? (
              <img src={user.colegio.logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <SigeOwl mood="proud" size="sm" className="sidebar-owl" label="Búho azul de SIGE" />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.colegio?.nombre ?? 'SIGE'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 1 }}>
                {user.rol.charAt(0) + user.rol.slice(1).toLowerCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {rolNav.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx('sidebar-nav-item', active && 'active')}
                    onClick={() => { if (window.innerWidth < 768) onClose?.(); }}
                  >
                    <i className={`bi ${item.icon}`} style={{ fontSize: '1rem', flexShrink: 0, width: 18 }} />
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{item.label}</span>
                    {item.href.endsWith('/chat') && noLeidos > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{noLeidos}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer usuario */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: (user as any).avatarUrl ? `url(${(user as any).avatarUrl}) center/cover` : 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {!(user as any).avatarUrl && <>{user.nombres?.[0]}{user.apellidos?.[0]}</>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#f1f5f9', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.nombres} {user.apellidos}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={toggleTheme}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, padding: '0.4rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`} />
            </button>
            <button onClick={logout}
              style={{ flex: 1, background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 6, padding: '0.4rem', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}
              title="Cerrar sesión">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
